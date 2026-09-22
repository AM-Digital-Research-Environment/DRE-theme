<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../helper/BrandPalette.php';
$failures = []; $checks = 0;
$palette = new OmekaTheme\Helper\BrandPalette();
$luminance = static function (string $hex): float {
    $v = array_map(static function ($hex) { $v = hexdec($hex) / 255; return $v <= 0.04045 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4; }, str_split(substr($hex, 1), 2));
    return $v[0] * .2126 + $v[1] * .7152 + $v[2] * .0722;
};
$ratio = static function ($a, $b) use ($luminance) { $a = $luminance($a); $b = $luminance($b); return (max($a, $b) + .05) / (min($a, $b) + .05); };
foreach (['#ffffff', '#000000', '#ffff00', '#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#777777', '#123456'] as $seed) {
    foreach ($palette($seed) as $mode => $tokens) {
        foreach (['primary', 'primary-hover', 'primary-active'] as $fill) {
            dre_check($failures, $checks, "$seed $mode $fill contrast", $ratio($tokens[$fill], $tokens['primary-contrast']) >= 4.5);
        }
        $surface = $mode === 'light' ? '#ecebe6' : '#202c26';
        dre_check($failures, $checks, "$seed $mode links", $ratio($tokens['primary-text'], $surface) >= 4.5);
        dre_check($failures, $checks, "$seed $mode focus", $ratio($tokens['primary'], $surface) >= 3);
    }
}
dre_check($failures, $checks, 'authored palette and invalid input require no override', $palette('#009260') === [] && $palette('url(evil)') === []);
dre_report('BrandPalette', $failures, $checks);
