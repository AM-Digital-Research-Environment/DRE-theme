<?php
/** Validate this checkout through Omeka 4.2.1's real theme manager. */
$omekaPath = rtrim((string) getenv('OMEKA_PATH'), '/');
if ($omekaPath === '' || !is_file($omekaPath . '/vendor/autoload.php')) {
    fwrite(STDERR, "OMEKA_PATH must point to an unpacked Omeka S 4.2.1 release.\n");
    exit(2);
}

if (!defined('OMEKA_PATH')) {
    define('OMEKA_PATH', $omekaPath);
}
require $omekaPath . '/vendor/autoload.php';
require_once $omekaPath . '/application/Module.php';
require_once __DIR__ . '/bootstrap.php';

use Laminas\ServiceManager\ServiceManager;
use Omeka\Service\ThemeManagerFactory;
use Omeka\Site\Theme\Manager as ThemeManager;

$failures = [];
$checks = 0;
$services = new ServiceManager();
$services->setService('Config', ['page_templates' => [], 'block_templates' => []]);
$manager = (new ThemeManagerFactory())($services, 'Omeka\Site\ThemeManager');
$theme = $manager->getTheme('dre');

dre_check($failures, $checks, 'Omeka discovers the theme', false !== $theme);
dre_check($failures, $checks, 'Omeka accepts theme.ini and its version constraint',
    $theme && $theme->getState() === ThemeManager::STATE_ACTIVE,
    $theme ? 'state: ' . $theme->getState() : 'theme not registered');
dre_check($failures, $checks, 'the PHP 8.5 support floor is Omeka 4.2.1',
    $theme && $theme->getIni('omeka_version_constraint') === '^4.2.1');

dre_report('OmekaCompatibility', $failures, $checks);
