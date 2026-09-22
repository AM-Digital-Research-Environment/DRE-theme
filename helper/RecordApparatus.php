<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/** Resolve citation and identifier data without emitting markup. */
class RecordApparatus extends AbstractHelper
{
    public function __invoke($resource): array
    {
        $view = $this->getView();
        $translate = $view->plugin('translate');
        // Values a reader must be able to read. Licence and access rights are linked
        // records here — `dcterms:license` points at the CC-BY-NC-SA-4.0 item, not at a
        // string — and casting one of those to string yields the *item's URL*, which is
        // what the rail used to print. Resolve the way common/resource-values.phtml
        // does: a linked value shows its title and links to the record; a URI value
        // falls back to the URI itself when it carries no label (otherwise the row
        // vanished entirely); a literal shows its text.
        //
        // All values, not just the first: records legitimately carry two access-rights
        // statements, one linked and one spelled out.
        $displayValues = function (string $term) use ($resource): array {
            try {
                $values = $resource->value($term, ['all' => true]) ?: [];
            } catch (\Throwable $e) {
                return [];
            }

            $out = [];
            foreach ($values as $value) {
                try {
                    $type = (string) $value->type();
                    $label = '';
                    $href = '';

                    if (false !== strpos($type, 'resource') && $value->valueResource()) {
                        $label = trim((string) $value->valueResource()->displayTitle());
                        $href = (string) $value->valueResource()->url();
                    } elseif ('uri' === $type) {
                        $href = (string) $value->uri();
                        $label = trim((string) $value) ?: $href;
                    } else {
                        $label = trim((string) $value);
                    }

                    if ($label !== '') {
                        $out[] = ['label' => $label, 'href' => $href];
                    }
                } catch (\Throwable $e) {
                    // One malformed value must not cost the reader the whole rail.
                    continue;
                }
            }

            return $out;
        };

        $citationValues = $displayValues('dcterms:bibliographicCitation');
        $citation = $citationValues ? $citationValues[0]['label'] : '';

        // DRE-SEO formats the record as Chicago/APA/MLA and offers BibTeX/RIS/CSL-JSON
        // downloads. The module is optional and may lag the theme on a deploy, so this
        // is a lookup and not a call: without it the panel falls back to the curated
        // citation above, which is exactly what it showed before the module existed.
        $cite = null;
        try {
            if ($view->getHelperPluginManager()->has('dreCitation')) {
                $cite = $view->dreCitation($resource);
            }
        } catch (\Throwable $e) {
            $cite = null;
        }
        $citeStyles = is_array($cite) && !empty($cite['styles']) ? $cite['styles'] : [];
        $citeDefault = $citeStyles[$cite['defaultStyle'] ?? ''] ?? null
            ? $cite['defaultStyle']
            : (string) array_key_first($citeStyles ?: ['' => null]);
        $citeDownloads = is_array($cite) && !empty($cite['downloads']) ? $cite['downloads'] : [];

        // A subject heading, a language, a person, a journal — the module says plainly
        // that these are describable but not citable, and a panel headed "Cite this
        // record" over a vocabulary term claims something untrue. The permalink is
        // still worth having, so the box stays and only its framing changes.
        //
        // Note the three-way read: `null` means the module is absent or switched off
        // and the theme cannot tell, in which case nothing changes.
        $isAuthority = is_array($cite) && ($cite['citable'] ?? true) === false;
        $panelTitle = $isAuthority ? $translate('This record') : $translate('Cite this record');
        $copyLabel = $isAuthority ? $translate('Copy link') : $translate('Copy citation');

        $doiValues = $displayValues('bibo:doi');
        $licence = $displayValues('dcterms:license');
        $accessRights = $displayValues('dcterms:accessRights');
        $dreId = $displayValues('dre:id');

        // A bare DOI string is still a resolvable link.
        foreach ($doiValues as $i => $doiValue) {
            if ($doiValue['href'] === '' && preg_match('~^10\.\d{4,9}/\S+$~', $doiValue['label'])) {
                $doiValues[$i]['href'] = 'https://doi.org/' . $doiValue['label'];
            }
        }

        // Absolute: this row is the thing a reader copies into a footnote, and it is
        // also the fallback the copy button hands over.
        try {
            $permalink = (string) $resource->url(null, true);
        } catch (\Throwable $e) {
            $permalink = '';
        }

        $rows = [];
        if ($doiValues) {
            $rows[] = ['label' => $translate('DOI'), 'values' => $doiValues];
        }
        if ($permalink !== '') {
            $rows[] = ['label' => $translate('Permalink'), 'values' => [['label' => $permalink, 'href' => $permalink]]];
        }
        if ($licence) {
            $rows[] = ['label' => $translate('Licence'), 'values' => $licence];
        }
        if ($accessRights) {
            $rows[] = ['label' => $translate('Access rights'), 'values' => $accessRights];
        }
        if ($dreId) {
            $rows[] = ['label' => $translate('DRE ID'), 'values' => $dreId];
        }

        if ($citation === '' && !$rows && !$citeStyles) {
            return [];
        }

        // One id per record so a page carrying two apparatus panels keeps its tabs and
        // panels unambiguously paired.
        $citeId = 'record-cite-' . (int) $resource->id();

        // Prefer a real citation; otherwise give the copy button something honest —
        // the record's title and its permalink. On an authority record the link IS the
        // payload: nobody wants "Artefact." pasted in front of it.
        if ($isAuthority) {
            $copyText = $permalink;
        } else {
            $copyText = $citation;
            if ($copyText === '') {
                try {
                    $copyText = trim($resource->displayTitle() . ($permalink !== '' ? '. ' . $permalink : ''));
                } catch (\Throwable $e) {
                    $copyText = $permalink;
                }
            }
        }

        // A licence entered as prose — "Educational, research, criticism, and review
        // purposes only." — is a sentence, not a token, and the right-aligned bold
        // treatment that suits a DOI turns it into a ragged bold block. Stack those.
        $isLongRow = function (array $row): bool {
            foreach ($row['values'] as $value) {
                if (mb_strlen($value['label']) > 40) {
                    return true;
                }
            }

            return count($row['values']) > 1;
        };

        return compact('citation', 'citeStyles', 'citeDefault', 'citeDownloads', 'citeId', 'panelTitle', 'copyLabel', 'copyText', 'rows', 'isLongRow');
    }
}
