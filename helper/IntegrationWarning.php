<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/**
 * Bound unexpected optional-module diagnostics without exposing errors to visitors.
 *
 * One log line per component per hour, across requests and containers: the
 * last time each component was logged is kept in Omeka's settings. All of
 * them share ONE settings row (`dre_theme_warnings`, entries older than the
 * hour dropped on each write), so the table holds one row however many
 * components ever warn; before, each component had a row of its own that was
 * never deleted. The row is written only when a line is logged, never on an
 * ordinary page view. Two requests racing on it can at worst log one line
 * twice, which is not worth a lock on a public page.
 */
class IntegrationWarning extends AbstractHelper
{
    public const SETTING = 'dre_theme_warnings';
    private const INTERVAL = 3600;

    /** @var array<string, true> */
    private array $reported = [];

    /**
     * @param \Omeka\Api\Representation\AbstractRepresentation|null $resource
     * @param string $detail what the theme was looking for, never visitor input
     */
    public function __invoke($resource, string $component, \Throwable $error, string $detail = ''): void
    {
        if (isset($this->reported[$component])) return;
        $this->reported[$component] = true;
        try {
            $services = $resource->getServiceLocator();
            $settings = $services->get('Omeka\Settings');
            $now = time();
            $logged = json_decode((string) $settings->get(self::SETTING, ''), true);
            $logged = is_array($logged) ? array_filter($logged, fn ($t) => is_int($t) && $t > $now - self::INTERVAL) : [];
            if (isset($logged[$component])) return;
            $logged[$component] = $now;
            $settings->set(self::SETTING, json_encode($logged));
            // The per-component row this replaced (theme ≤ 2.48).
            $settings->delete('dre_theme_warning_' . hash('sha256', $component));
            $services->get('Omeka\Logger')->warn($detail !== ''
                ? 'DRE theme ' . $component . ': ' . $detail
                : 'DRE theme ' . $component . ' failed (' . get_class($error) . ').');
        } catch (\Throwable $ignored) { /* Diagnostics must never break rendering. */ }
    }
}
