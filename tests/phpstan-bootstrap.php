<?php
/**
 * PHPStan bootstrap (phpstan.neon): what Omeka's own bootstrap.php provides
 * at runtime — the OMEKA_PATH constant and Composer's autoloader for Omeka\
 * and Laminas\ — without its chdir() and request setup.
 */
$omekaPath = (string) getenv('OMEKA_PATH');
if ($omekaPath === '' || !is_file($omekaPath . '/vendor/autoload.php')) {
    fwrite(STDERR, "phpstan-bootstrap: set OMEKA_PATH to an unpacked Omeka S release.\n");
    exit(2);
}
defined('OMEKA_PATH') || define('OMEKA_PATH', $omekaPath);
require $omekaPath . '/vendor/autoload.php';
