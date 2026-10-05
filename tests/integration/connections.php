<?php
/** Execute the real Omeka 4.2.1 relationship builder against an isolated SQLite DB. */
$omekaPath = rtrim((string) getenv('OMEKA_PATH'), '/');
if ($omekaPath === '' || !is_file($omekaPath . '/bootstrap.php')) {
    fwrite(STDERR, "OMEKA_PATH must point to an unpacked Omeka S 4.2.1 release.\n");
    exit(2);
}
require $omekaPath . '/bootstrap.php';
require __DIR__ . '/../bootstrap.php';
require __DIR__ . '/../../helper/ConnectionPage.php';
require __DIR__ . '/../../helper/ConnectionQuery.php';

$failures = []; $checks = 0;
$services = new Laminas\ServiceManager\ServiceManager();
$config = require OMEKA_PATH . '/application/config/module.config.php';
$config['entity_manager']['is_dev_mode'] = true;
$services->setService('ApplicationConfig', ['connection' => []]);
$services->setService('Config', $config);
$services->setService('EventManager', new Laminas\EventManager\EventManager());
$services->setService('Omeka\Connection', Doctrine\DBAL\DriverManager::getConnection(['driver' => 'pdo_sqlite', 'memory' => true]));
$services->setService('Omeka\Acl', new class { public function userIsAllowed(...$args) { return false; } });
$services->setService('Omeka\AuthenticationService', new class { public function getIdentity() { return null; } });
$emConfig = Doctrine\ORM\Tools\Setup::createAnnotationMetadataConfiguration($config['entity_manager']['mapping_classes_paths'], true);
$emConfig->setNamingStrategy(new Doctrine\ORM\Mapping\UnderscoreNamingStrategy(CASE_LOWER, true));
foreach ($config['entity_manager']['data_types'] as $name => $class) {
    if (!Doctrine\DBAL\Types\Type::hasType($name)) Doctrine\DBAL\Types\Type::addType($name, $class);
}
foreach ($config['entity_manager']['filters'] as $name => $class) $emConfig->addFilter($name, $class);
$em = Doctrine\ORM\EntityManager::create($services->get('Omeka\Connection'), $emConfig);
$em->getEventManager()->addEventListener(Doctrine\ORM\Events::loadClassMetadata,
    new Omeka\Db\Event\Listener\ResourceDiscriminatorMap($config['entity_manager']['resource_discriminator_map']));
foreach (['resource_visibility', 'value_visibility'] as $name) $em->getFilters()->enable($name)->setServiceLocator($services);
$services->setService('Omeka\EntityManager', $em);
$em->getConnection()->getWrappedConnection()->sqliteCreateCollation('utf8mb4_bin', 'strcmp');
$schema = (new Doctrine\ORM\Tools\SchemaTool($em))->getSchemaFromMetadata($em->getMetadataFactory()->getAllMetadata());
// SQLite shares table/index names globally; Omeka's MySQL names are per table.
foreach ($schema->getTables() as $table) foreach ($table->getIndexes() as $index) {
    if (!$index->isPrimary()) $table->renameIndex($index->getName(), $table->getName() . '_' . $index->getName());
}
foreach ($schema->toSql($em->getConnection()->getDatabasePlatform()) as $sql) $em->getConnection()->executeStatement($sql);
$adapter = new Omeka\Api\Adapter\ItemAdapter();
$adapter->setServiceLocator($services);
$manager = new class($adapter) { public function __construct(private $adapter) {} public function get($name) { return $this->adapter; } };
$services->setService('Omeka\ApiAdapterManager', $manager);

$site = new Omeka\Entity\Site(); $site->setSlug('test'); $site->setTitle('Test'); $site->setTheme('dre'); $site->setNavigation([]); $site->setItemPool([]); $site->setCreated(new DateTime()); $em->persist($site);
$vocabulary = new Omeka\Entity\Vocabulary(); $vocabulary->setPrefix('dre'); $vocabulary->setLabel('DRE'); $vocabulary->setNamespaceUri('https://example.test/vocab#'); $em->persist($vocabulary);
$property = new Omeka\Entity\Property(); $property->setVocabulary($vocabulary); $property->setLocalName('related'); $property->setLabel('Related'); $em->persist($property);
$templates = [];
foreach (['Author', 'Editor'] as $label) {
    $template = new Omeka\Entity\ResourceTemplate(); $template->setLabel($label); $em->persist($template);
    $tp = new Omeka\Entity\ResourceTemplateProperty(); $tp->setResourceTemplate($template); $tp->setProperty($property); $tp->setAlternateLabel($label); $tp->setPosition(0); $em->persist($tp);
    $templates[] = [$template, $tp];
}
$item = function ($title, $member = true, $public = true) use ($em, $site) {
    $item = new Omeka\Entity\Item(); $item->setTitle($title); $item->setCreated(new DateTime()); $item->setIsPublic($public);
    if ($member) $item->getSites()->add($site);
    $em->persist($item); return $item;
};
$target = $item('Target');
$edge = function ($source, $public = true) use ($em, $property, $target) {
    $value = new Omeka\Entity\Value(); $value->setResource($source); $value->setProperty($property); $value->setValueResource($target); $value->setType('resource:item'); $value->setIsPublic($public); $em->persist($value);
};
$a = $item('Alpha 100%'); $a->setResourceTemplate($templates[0][0]);
for ($i = 0; $i < 1000; ++$i) $edge($a);
$b = $item('Beta'); $b->setResourceTemplate($templates[1][0]); $edge($b);
$c = $item('Gamma'); $edge($c);
$edge($item('Excluded site', false)); $edge($item('Private record', true, false)); $edge($item('Private edge'), false);
$media = new Omeka\Entity\Media(); $media->setItem($a); $media->setTitle('Media Alpha'); $media->setCreated(new DateTime()); $media->setIngester('url'); $media->setRenderer('file'); $media->setData([]); $media->setResourceTemplate($templates[0][0]); $em->persist($media); $edge($media);
$em->flush();

class ConnectionTestCallback extends Laminas\View\Helper\AbstractHelper {
    public function __construct(private $callback) {}
    public function __invoke(...$args) { return ($this->callback)(...$args); }
}
$plugins = new Laminas\View\HelperPluginManager($services);
$view = new Laminas\View\Renderer\PhpRenderer(); $view->setHelperPluginManager($plugins);
$settings = ['exclude_resources_not_in_site' => true, 'pagination_per_page' => 1];
$plugins->setService('siteSetting', new ConnectionTestCallback(fn($key, $default = null) => $settings[$key] ?? $default));
$plugins->setService('currentSite', new ConnectionTestCallback(fn() => new class($site->getId()) { public function __construct(private $id) {} public function id() { return $this->id; } }));
$requested = [];
$plugins->setService('api', new ConnectionTestCallback(fn() => new class($em, $requested) {
    public function __construct(private $em, public array &$requested) {}
    public function search($type, $query) {
        $this->requested[] = $query;
        $items = $this->em->getRepository($type === 'media' ? 'Omeka\Entity\Media' : 'Omeka\Entity\Item')->findBy(['id' => $query['id']]);
        return new class($items) {
            public function __construct(private $items) {}
            public function getContent() { return array_map(fn($item) => new class($item) { public function __construct(private $item) {} public function id() { return $this->item->getId(); } }, $this->items); }
        };
    }
}));
$queryHelper = new OmekaTheme\Helper\ConnectionQuery(); $plugins->setService('ConnectionQuery', $queryHelper);
$helper = new OmekaTheme\Helper\ConnectionPage(); $helper->setView($view);
$resource = new class($target->getId(), $services) { public function __construct(private $id, private $services) {} public function getServiceLocator() { return $this->services; } public function id() { return $this->id; } public function resourceName() { return 'items'; } };

$all = $helper($resource);
dre_check($failures, $checks, 'count is distinct, public and site scoped despite 1000 duplicate edges', $all['totalCount'] === 3);
dre_check($failures, $checks, 'only one page of records is hydrated and edge rows are collapsed', count($all['subjectValues'][0]) === 1 && count($all['resourcePropertiesAll']['items']) === 3);
$compound = 'items:' . $property->getId() . '-' . $templates[1][1]->getId();
$filtered = $helper($resource, ['lr_property' => $compound, 'lr_page' => 99]);
dre_check($failures, $checks, 'real compound IDs round-trip with filtered count and clamped page', $filtered['resourceProperty'] === $compound && $filtered['totalCount'] === 1 && $filtered['page'] === 1 && $filtered['subjectValues'][0][0]['resource_id'] === $b->getId());
$withoutTemplate = $helper($resource, ['lr_property' => 'items:' . $property->getId() . '-0']);
dre_check($failures, $checks, 'zero selects absent template properties', $withoutTemplate['totalCount'] === 1 && $withoutTemplate['subjectValues'][0][0]['resource_id'] === $c->getId());
$search = $helper($resource, ['lr_q' => 'BETA']);
dre_check($failures, $checks, 'search reaches a record beyond the initial page', $search['totalCount'] === 1 && $search['subjectValues'][0][0]['resource_id'] === $b->getId());
$search = $helper($resource, ['lr_q' => '%']);
dre_check($failures, $checks, 'SQL wildcard characters are searched literally', $search['totalCount'] === 1);
$empty = $helper($resource, ['lr_q' => 'Not present']);
dre_check($failures, $checks, 'empty searches preserve the available relationship controls', $empty['totalCount'] === 0 && count($empty['resourcePropertiesAll']['items']) === 3 && !$empty['subjectValues']);
$mediaPage = $helper($resource, ['lr_property' => 'media:' . $property->getId() . '-0,' . $templates[0][1]->getId()]);
dre_check($failures, $checks, 'media compound filters retain their resource type and template constraints', $mediaPage['resourceType'] === 'media' && $mediaPage['totalCount'] === 1 && $mediaPage['subjectValues'][0][0]['resource_id'] === $media->getId());
$rawSelector = $adapter->getSubjectValuesQueryBuilder($target, null, 'items', $site->getId())->andWhere('value.isPublic = true')->join('value.property', 'property')->select(['property.id property_id', 'resource_template_property.id template_id']);
$rawRows = count($rawSelector->getQuery()->getArrayResult());
$distinctRows = count($rawSelector->distinct()->getQuery()->getArrayResult());
dre_check($failures, $checks, 'selector projection collapses 1002 edge rows to 3 property/template rows', $rawRows === 1002 && $distinctRows === 3);
echo "Selector fixture: $rawRows edge rows → $distinctRows distinct rows; record hydration capped at 1 per page.\n";
dre_report('OmekaConnections', $failures, $checks);
