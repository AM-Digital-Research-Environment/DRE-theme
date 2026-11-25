<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * One page of distinct inbound records, and the shape of the whole set they
 * belong to, using Omeka's ACL/site-aware builder.
 *
 * The overview is aggregate queries only: COUNT(DISTINCT) over each resource
 * type, grouped by property/template property for the relationships and by
 * resource class for the kinds of record. Never every edge, never every
 * record: IDs are paged before representations are hydrated through the
 * authorised API.
 *
 * A record has at most one template property per property (its own template's),
 * so a relationship group's count, summed over its template properties, counts
 * each record once. Groups are counted as facets: the relationships within the
 * search and the selected kind of record, the kinds within the search and the
 * selected relationship. The whole-set counts stay alongside, so a relationship
 * a search empties is still listed.
 *
 * Visibility is core's: the builder's own resource check plus the
 * `value_visibility` Doctrine filter, which hides private values from visitors
 * and shows them to whoever may see them (curators, a value's owner), exactly
 * as core's linked-resources list does. Adding `value.isPublic = true` on top
 * hid private links from the curators who need to check them.
 *
 * Core's `api.subject_values.query` event is not triggered: it is fired by
 * getSubjectValues() on that method's own query (its `val` select, its order),
 * and these are different queries (grouped counts, a title search, id paging),
 * on which a listener written for core's query could break.
 *
 * @phpstan-type PropertyGroup array{label: string, property_id: int, label_is_translatable: bool, compound_id: string, count: int, matched: int}
 * @phpstan-type ClassGroup array{id: int, label: string, count: int}
 */
final class ConnectionPage extends AbstractHelper
{
    /**
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @param array<mixed> $query
     * @return array{subjectValues: array{}|array{0: list<array{resource_id: int, property_id: int, property_label: string, property_alternate_label: string|null, resource: \Omeka\Api\Representation\AbstractResourceEntityRepresentation}>}, totalCount: int, setTotal: int, typeTotals: array{items: int, media: int}, page: int, perPage: int, resourceType: string, resourceProperty: string, resourcePropertiesAll: array{items: list<PropertyGroup>, media: list<PropertyGroup>}, resourceClasses: list<ClassGroup>, resourceClass: int|null, sort: string, objectResource: \Omeka\Api\Representation\AbstractResourceEntityRepresentation, connectionSearch: string}
     */
    public function __invoke($resource, array $query = []): array
    {
        $view = $this->getView();
        $state = $view->ConnectionQuery($query);
        $siteId = $view->siteSetting('exclude_resources_not_in_site') ? $view->currentSite()->id() : null;
        $services = $resource->getServiceLocator();
        $adapter = $services->get('Omeka\ApiAdapterManager')->get($resource->resourceName());
        $entityManager = $adapter->getEntityManager();
        $entity = $entityManager->find('Omeka\Entity\Resource', $resource->id());
        $builder = fn(string $type, ?string $spec = null) => $adapter->getSubjectValuesQueryBuilder($entity, $spec, $type, $siteId);
        $narrowed = $state['search'] !== '' || $state['class'] !== null;

        $properties = ['items' => [], 'media' => []];
        $typeTotals = ['items' => 0, 'media' => 0];
        $setTotal = 0;
        foreach (['items', 'media'] as $type) {
            $groups = self::properties(self::relationshipRows($builder($type)), $type);
            if (!$groups) {
                continue;
            }
            $whole = self::distinctCount($builder($type));
            $setTotal += $whole;
            $typeTotals[$type] = $whole;
            if ($narrowed) {
                $matched = self::properties(self::relationshipRows(self::narrow($builder($type), $state, true)), $type);
                $groups = self::withMatches($groups, $matched);
                $typeTotals[$type] = self::distinctCount(self::narrow($builder($type), $state, true));
            }
            $properties[$type] = $groups;
        }

        $property = $state['property'];
        if ($property === null || !$properties[strstr($property, ':', true)]) {
            $property = $properties['items'] ? 'items:' : 'media:';
        }
        [$type, $spec] = explode(':', $property, 2);
        $spec = $spec ?: null;
        $base = self::narrow($builder($type, $spec), $state, true);
        $total = self::distinctCount($base);
        $classes = self::classes(self::classRows(self::narrow($builder($type, $spec), $state, false)));
        if ($state['class'] !== null && !in_array($state['class'], array_column($classes, 'id'), true)) {
            // The selected kind stays listed (and undoable) when nothing matches it.
            $class = $state['class'] ? $entityManager->find('Omeka\Entity\ResourceClass', $state['class']) : null;
            $classes[] = ['id' => $state['class'], 'label' => $class ? (string) $class->getLabel() : '', 'count' => 0];
        }

        // As core: the site's page size, else the global one.
        $perPage = (int) $view->siteSetting('pagination_per_page') ?: (int) $view->setting('pagination_per_page', 25);
        $perPage = max(1, min(100, $perPage));
        $page = min($state['page'], max(1, (int) ceil($total / $perPage)));
        $direction = $state['sort'] === 'title-desc' ? 'DESC' : 'ASC';
        // DISTINCT needs its ORDER BY columns selected (MySQL error 3065).
        $ids = (clone $base)->select(['resource.id id', 'resource.title title'])->distinct()
            ->orderBy('resource.title', $direction)->addOrderBy('resource.id', $direction)->setFirstResult(($page - 1) * $perPage)
            ->setMaxResults($perPage)->getQuery()->getArrayResult();
        $subjectValues = [];
        if ($ids) {
            $ids = array_map('intval', array_column($ids, 'id'));
            $records = [];
            foreach ($view->api()->search($type, ['id' => $ids, 'per_page' => $perPage], ['countQuery' => false])->getContent() as $record) {
                $records[$record->id()] = $record;
            }
            $rows = (clone $base)->andWhere('resource.id IN (:dre_connection_ids)')->setParameter('dre_connection_ids', $ids)
                ->join('value.property', 'property')
                ->select(['resource.id resource_id', 'property.id property_id', 'property.label property_label',
                    'resource_template_property.alternateLabel property_alternate_label'])
                ->distinct()->orderBy('property.id')->getQuery()->getArrayResult();
            $byRecord = [];
            foreach ($rows as $row) {
                $byRecord[(int) $row['resource_id']][] = $row;
            }
            // The page keeps the order the whole set was sorted in.
            foreach ($ids as $id) {
                if (!isset($records[$id])) {
                    continue;
                }
                foreach ($byRecord[$id] ?? [] as $row) {
                    $row['resource'] = $records[$id];
                    $subjectValues[0][] = $row;
                }
            }
        }
        return ['subjectValues' => $subjectValues, 'totalCount' => $total, 'setTotal' => $setTotal,
            'typeTotals' => $typeTotals, 'page' => $page, 'perPage' => $perPage, 'resourceType' => $type,
            'resourceProperty' => $property, 'resourcePropertiesAll' => $properties,
            'resourceClasses' => $classes, 'resourceClass' => $state['class'], 'sort' => $state['sort'],
            'objectResource' => $resource, 'connectionSearch' => $state['search']];
    }

    /**
     * Mirrors Omeka's grouping contract without retaining duplicate edge rows:
     * one group per property and label, its template properties joined in the
     * compound id, its count the sum of theirs. Most-linked first.
     *
     * @param list<array{property_id: int, property_label: string, resource_template_property_id: int|null, property_alternate_label: string|null, total?: int}> $rows
     * @return list<PropertyGroup>
     */
    public static function properties(array $rows, string $type): array
    {
        $groups = [];
        foreach ($rows as $row) {
            $label = $row['property_alternate_label'] ?: $row['property_label'];
            $key = $row['property_id'] . ':' . $label;
            if (!isset($groups[$key])) {
                $groups[$key] = ['label' => $label, 'property_id' => (int) $row['property_id'],
                    'label_is_translatable' => false, 'ids' => [], 'count' => 0];
            }
            $groups[$key]['label_is_translatable'] = $groups[$key]['label_is_translatable'] || !$row['property_alternate_label'];
            $groups[$key]['ids'][] = $row['resource_template_property_id'] ?: 0;
            $groups[$key]['count'] += (int) ($row['total'] ?? 0);
        }
        $result = [];
        foreach ($groups as $group) {
            $result[] = ['label' => $group['label'], 'property_id' => $group['property_id'],
                'label_is_translatable' => $group['label_is_translatable'],
                'compound_id' => $type . ':' . $group['property_id'] . '-' . implode(',', array_unique($group['ids'])),
                'count' => $group['count'], 'matched' => $group['count']];
        }
        // Stable: ties keep the property order the rows came in.
        usort($result, fn($a, $b) => $b['count'] <=> $a['count']);
        return $result;
    }

    /**
     * The whole-set groups, each carrying its count within the narrowed set
     * (zero when the narrowing leaves it no record), most-matched first.
     *
     * @param list<PropertyGroup> $groups
     * @param list<PropertyGroup> $matched
     * @return list<PropertyGroup>
     */
    public static function withMatches(array $groups, array $matched): array
    {
        $counts = [];
        foreach ($matched as $group) {
            $counts[$group['property_id'] . ':' . $group['label']] = $group['count'];
        }
        foreach ($groups as &$group) {
            $group['matched'] = $counts[$group['property_id'] . ':' . $group['label']] ?? 0;
        }
        unset($group);
        usort($groups, fn($a, $b) => ($b['matched'] <=> $a['matched']) ?: ($b['count'] <=> $a['count']));
        return $groups;
    }

    /**
     * Kinds of record, most frequent first; id 0 gathers the unclassed.
     *
     * @param list<array{class_id: int|null, class_label: string|null, total: int}> $rows
     * @return list<ClassGroup>
     */
    public static function classes(array $rows): array
    {
        $classes = [];
        foreach ($rows as $row) {
            $classes[] = ['id' => (int) $row['class_id'], 'label' => (string) $row['class_label'], 'count' => (int) $row['total']];
        }
        usort($classes, fn($a, $b) => ($b['count'] <=> $a['count']) ?: strcmp($a['label'], $b['label']));
        return $classes;
    }

    /**
     * @param \Doctrine\ORM\QueryBuilder $qb
     * @param array{search: string, class: int|null} $state
     * @return \Doctrine\ORM\QueryBuilder
     */
    private static function narrow($qb, array $state, bool $withClass)
    {
        if ($state['search'] !== '') {
            // A literal, case-insensitive title substring: %, _ and ! are not wildcards.
            $qb->andWhere("LOWER(resource.title) LIKE :dre_connection_title ESCAPE '!'")
                ->setParameter('dre_connection_title', '%' . strtr(mb_strtolower($state['search']), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%');
        }
        if ($withClass && $state['class'] !== null) {
            if ($state['class'] === 0) {
                $qb->andWhere('resource.resourceClass IS NULL');
            } else {
                $qb->andWhere('IDENTITY(resource.resourceClass) = :dre_connection_class')
                    ->setParameter('dre_connection_class', $state['class']);
            }
        }
        return $qb;
    }

    /** @param \Doctrine\ORM\QueryBuilder $qb */
    private static function distinctCount($qb): int
    {
        return (int) (clone $qb)->select('COUNT(DISTINCT resource.id)')->getQuery()->getSingleScalarResult();
    }

    /**
     * @param \Doctrine\ORM\QueryBuilder $qb
     * @return list<array{property_id: int, property_label: string, resource_template_property_id: int|null, property_alternate_label: string|null, total: int}>
     */
    private static function relationshipRows($qb): array
    {
        return $qb->join('value.property', 'property')
            ->select(['property.id property_id', 'property.label property_label',
                'resource_template_property.id resource_template_property_id',
                'resource_template_property.alternateLabel property_alternate_label',
                'COUNT(DISTINCT resource.id) total'])
            ->groupBy('property.id')->addGroupBy('property.label')
            ->addGroupBy('resource_template_property.id')->addGroupBy('resource_template_property.alternateLabel')
            ->orderBy('property.id')->addOrderBy('resource_template_property.id')
            ->getQuery()->getArrayResult();
    }

    /**
     * @param \Doctrine\ORM\QueryBuilder $qb
     * @return list<array{class_id: int|null, class_label: string|null, total: int}>
     */
    private static function classRows($qb): array
    {
        return $qb->leftJoin('resource.resourceClass', 'dre_connection_class')
            ->select(['dre_connection_class.id class_id', 'dre_connection_class.label class_label',
                'COUNT(DISTINCT resource.id) total'])
            ->groupBy('dre_connection_class.id')->addGroupBy('dre_connection_class.label')
            ->getQuery()->getArrayResult();
    }
}
