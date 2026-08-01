<?php
namespace Laminas\View\Helper {
    if (!class_exists(AbstractHelper::class)) {
        abstract class AbstractHelper
        {
            protected $view;
            public function setView($view) { $this->view = $view; }
            public function getView() { return $this->view; }
        }
    }
}

namespace {
    error_reporting(E_ALL);
    set_error_handler(static function (
        int $severity,
        string $message,
        string $file,
        int $line
    ): bool {
        if (!(error_reporting() & $severity)) {
            return false;
        }
        throw new \ErrorException($message, 0, $severity, $file, $line);
    });

    function dre_check(array &$failures, int &$checks, string $what, bool $ok, string $detail = ''): void
    {
        $checks++;
        if (!$ok) {
            $failures[] = $what . ($detail !== '' ? "\n      {$detail}" : '');
        }
    }

    function dre_report(string $suite, array $failures, int $checks): void
    {
        if ($failures) {
            fwrite(STDERR, $suite . ': ' . count($failures) . " failure(s) of {$checks} checks\n\n");
            foreach ($failures as $failure) {
                fwrite(STDERR, '  ✗ ' . $failure . "\n");
            }
            exit(1);
        }
        echo "{$suite}: {$checks} checks passed.\n";
    }
}
