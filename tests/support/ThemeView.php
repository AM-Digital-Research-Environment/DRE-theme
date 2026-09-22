<?php
/** Minimal renderer for executing the actual theme partials, without a database. */
class ThemeTestView
{
    public array $settings = [];
    public array $query = [];
    public array $callbacks = [];
    public array $helpers = [];
    public array $assets = [];
    public string $showTitleOption = 'file_name';
    public string $thumbnailType = 'square';
    public function render(string $template, array $vars = []): string
    {
        extract($vars, EXTR_SKIP);
        ob_start();
        try { include dirname(__DIR__, 2) . '/view/' . $template . '.phtml'; return ob_get_clean(); }
        catch (Throwable $e) { ob_end_clean(); throw $e; }
    }
    public function partial(string $template, array $vars = []): string { return $this->render($template, $vars); }
    public function translate(string $text): string { return $text; }
    public function translatePlural(string $one, string $many, int $count): string { return $count === 1 ? $one : $many; }
    public function escapeHtml($text): string { return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8'); }
    public function escapeHtmlAttr($text): string { return $this->escapeHtml($text); }
    public function themeSetting(string $key, $default = null) { return $this->settings[$key] ?? $default; }
    public function siteSetting(string $key, $default = null) { return $this->settings[$key] ?? $default; }
    public function setting(string $key, $default = null) { return $this->settings[$key] ?? $default; }
    public function lang(): string { return 'fr'; }
    public function plugin(string $name): callable { return fn(...$args) => $this->$name(...$args); }
    public function getHelperPluginManager(): self { return $this; }
    public function has(string $name): bool { return isset($this->callbacks[$name]); }
    public function inlineScript(): self { return $this; }
    public function appendFile(string $file): self { $this->assets[] = $file; return $this; }
    public function assetUrl(string $file): string { return '/themes/dre/asset/' . $file; }
    public function params(): self { return $this; }
    public function fromQuery(string $key, $default = null) { return $this->query[$key] ?? $default; }
    public function trigger(...$args): void {}
    public function status(): self { return $this; }
    public function isSiteRequest(): bool { return true; }
    public function __call(string $name, array $args)
    {
        if (isset($this->callbacks[$name])) return ($this->callbacks[$name])(...$args);
        $class = 'OmekaTheme\\Helper\\' . $name;
        $file = dirname(__DIR__, 2) . '/helper/' . $name . '.php';
        if (!is_file($file)) throw new LogicException('Unmocked view method: ' . $name);
        require_once $file;
        if (!isset($this->helpers[$name])) { $this->helpers[$name] = new $class(); $this->helpers[$name]->setView($this); }
        return ($this->helpers[$name])(...$args);
    }
}

class ThemeTestResource
{
    public array $values = [];
    public array $options = [];
    public $media = null;
    public function __construct(public string $title = 'A record', public int $identifier = 1) {}
    public function id(): int { return $this->identifier; }
    public function resourceName(): string { return 'items'; }
    public function resourceClass() { return null; }
    public function displayTitle($default = null, $lang = null): string { return $this->title; }
    public function displayDescription($default = null, $lang = null): string { return 'Description'; }
    public function primaryMedia() { return $this->media; }
    public function url($site = null, bool $canonical = false): string { return ($canonical ? 'https://example.test' : '') . '/s/a/item/' . $this->id(); }
    public function value(string $term, array $options = []) { $this->options[] = [$term, $options]; return $this->values[$term] ?? ($options['default'] ?? (($options['all'] ?? false) ? [] : null)); }
    public function link($title): string { return '<a href="' . $this->url() . '">' . htmlspecialchars((string) $title) . '</a>'; }
    public function linkRaw($html, ...$args): string { return '<a href="' . $this->url() . '">' . $html . '</a>'; }
}

class ThemeTestValue
{
    public function __construct(public string $text, public string $kind = 'literal', public ?ThemeTestResource $linked = null) {}
    public function type(): string { return $this->kind; }
    public function valueResource() { return $this->linked; }
    public function uri(): string { return $this->text; }
    public function __toString(): string { return $this->text; }
}
