<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * One page of distinct inbound records, using Omeka's ACL/site-aware builder.
 * Selector queries project DISTINCT property/template pairs, never all edges.
 * IDs are paged before representations are hydrated through the authorized API.
 */
class ConnectionPage extends AbstractHelper
{
    public function __invoke($resource, array $query = []): array
    {
        $view = $this->getView();
        $state = $view->ConnectionQuery($query);
        $siteId = $view->siteSetting('exclude_resources_not_in_site') ? $view->currentSite()->id() : null;
        $services = $resource->getServiceLocator();
        $adapter = $services->get('Omeka\ApiAdapterManager')->get($resource->resourceName());
        $entity = $adapter->getEntityManager()->find('Omeka\Entity\Resource', $resource->id());
        $properties = [];
        foreach (['items', 'media'] as $type) {
            $qb = $adapter->getSubjectValuesQueryBuilder($entity, null, $type, $siteId);
            $rows = $qb->andWhere('value.isPublic = true')->join('value.property', 'property')
                ->select(['property.id property_id', 'property.label property_label',
                    'resource_template_property.id resource_template_property_id',
                    'resource_template_property.alternateLabel property_alternate_label'])
                ->distinct()->orderBy('property.id')->addOrderBy('resource_template_property.id')
                ->getQuery()->getArrayResult();
            $properties[$type] = self::properties($rows, $type);
        }
        $property = $state['property'];
        if ($property === null || !$properties[strstr($property, ':', true)]) {
            $property = $properties['items'] ? 'items:' : 'media:';
        }
        [$type, $spec] = explode(':', $property, 2);
        $base = $adapter->getSubjectValuesQueryBuilder($entity, $spec ?: null, $type, $siteId);
        $base->andWhere('value.isPublic = true');
        if ($state['search'] !== '') {
            // A literal, case-insensitive title substring: %, _ and ! are not wildcards.
            $base->andWhere("LOWER(resource.title) LIKE :dre_connection_title ESCAPE '!'")
                ->setParameter('dre_connection_title', '%' . strtr(mb_strtolower($state['search']), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%');
        }
        $total = (int) (clone $base)->select('COUNT(DISTINCT resource.id)')->getQuery()->getSingleScalarResult();
        // As core: the site's page size, else the global one.
        $perPage = (int) $view->siteSetting('pagination_per_page') ?: (int) $view->setting('pagination_per_page', 25);
        $perPage = max(1, min(100, $perPage));
        $page = min($state['page'], max(1, (int) ceil($total / $perPage)));
        $ids = (clone $base)->select(['resource.id id', 'resource.title title'])->distinct()
            ->orderBy('resource.title')->addOrderBy('resource.id')->setFirstResult(($page - 1) * $perPage)
            ->setMaxResults($perPage)->getQuery()->getArrayResult();
        $subjectValues = [];
        if ($ids) {
            $ids = array_column($ids, 'id');
            $records = [];
            foreach ($view->api()->search($type, ['id' => $ids, 'per_page' => $perPage], ['countQuery' => false])->getContent() as $record) {
                $records[$record->id()] = $record;
            }
            $rows = (clone $base)->andWhere('resource.id IN (:dre_connection_ids)')->setParameter('dre_connection_ids', $ids)
                ->join('value.property', 'property')
                ->select(['resource.id resource_id', 'property.id property_id', 'property.label property_label',
                    'resource_template_property.alternateLabel property_alternate_label'])
                ->distinct()->getQuery()->getArrayResult();
            foreach ($rows as $row) {
                if (isset($records[$row['resource_id']])) {
                    $row['resource'] = $records[$row['resource_id']];
                    $subjectValues[0][] = $row;
                }
            }
        }
        return ['subjectValues' => $subjectValues, 'totalCount' => $total, 'page' => $page,
            'perPage' => $perPage, 'resourceType' => $type, 'resourceProperty' => $property,
            'resourcePropertiesAll' => $properties, 'objectResource' => $resource,
            'connectionSearch' => $state['search']];
    }

    /** Mirrors Omeka's grouping contract without retaining duplicate edge rows. */
    public static function properties(array $rows, string $type): array
    {
        $groups = [];
        foreach ($rows as $row) {
            $label = $row['property_alternate_label'] ?: $row['property_label'];
            $key = $row['property_id'] . ':' . $label;
            if (!isset($groups[$key])) {
                $groups[$key] = ['label' => $label, 'property_id' => $row['property_id'],
                    'label_is_translatable' => false, 'ids' => []];
            }
            $groups[$key]['label_is_translatable'] = $groups[$key]['label_is_translatable'] || !$row['property_alternate_label'];
            $groups[$key]['ids'][] = $row['resource_template_property_id'] ?: 0;
        }
        foreach ($groups as &$group) {
            $group['compound_id'] = $type . ':' . $group['property_id'] . '-' . implode(',', array_unique($group['ids']));
            unset($group['ids']);
        }
        unset($group);
        return array_values($groups);
    }
}
