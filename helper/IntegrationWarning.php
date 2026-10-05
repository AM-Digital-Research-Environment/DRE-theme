<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/** Bound unexpected optional-module diagnostics without exposing errors to visitors. */
class IntegrationWarning extends AbstractHelper
{
    private array $reported = [];
    public function __invoke($resource, string $component, \Throwable $error): void
    {
        if (isset($this->reported[$component])) return;
        $this->reported[$component] = true;
        try {
            $services = $resource->getServiceLocator();
            $settings = $services->get('Omeka\Settings');
            $key = 'dre_theme_warning_' . hash('sha256', $component);
            if ((int) $settings->get($key, 0) > time() - 3600) return;
            $settings->set($key, time());
            $services->get('Omeka\Logger')->warn('DRE theme ' . $component . ' failed (' . get_class($error) . ').');
        } catch (\Throwable $ignored) { /* Diagnostics must never break rendering. */ }
    }
}
