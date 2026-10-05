<?php
class ThemeNavPage
{
    public function __construct(private string $label, private string $href, private array $children = [], private bool $visible = true, private bool $active = false, private string $target = '') {}
    public function getLabel() { return $this->label; }
    public function getTitle() { return ''; }
    public function getHref() { return $this->href; }
    public function getTarget() { return $this->target; }
    public function getPages() { return $this->children; }
    public function hasPages() { return (bool) $this->children; }
    public function isVisible() { return $this->visible; }
    public function isActive($recursive = false) { return $this->active || ($recursive && (bool) array_filter($this->children, fn($child) => $child->isActive(true))); }
}
class ThemeNavSite
{
    public function id() { return 1; }
    public function url() { return '/s/a/'; }
    public function title() { return 'Research archive'; }
    public function publicNav() { return $this; }
    public function getContainer() { return $this; }
    public function getPages() {
        return [new ThemeNavPage('Research', '/s/a/page/research', [
            new ThemeNavPage('Projects', '/s/a/page/projects', [new ThemeNavPage('Project archive', '/s/a/page/archive', [], true, true)]),
            new ThemeNavPage('Hidden', '/hidden', [], false),
            new ThemeNavPage('External partner', 'https://example.org', [], true, false, '_blank'),
        ]), new ThemeNavPage('About', '/s/a/page/about')];
    }
}
