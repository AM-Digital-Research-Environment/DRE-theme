<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/** Stable per-record anchors; repeated metadata blocks receive unique suffixes. */
class SectionPrefix extends AbstractHelper
{
    private array $uses = [];
    public function __invoke(int $id): string
    {
        $number = $this->uses[$id] = ($this->uses[$id] ?? 0) + 1;
        return 'record-' . $id . ($number > 1 ? '-' . $number : '');
    }
}
