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
        $displayValues = function (string $term, bool $withGloss = false) use ($resource, $view): array {
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
                        $entry = ['label' => $label, 'href' => $href];
                        // "Public" under Access rights reads as "downloadable
                        // here"; its authority record says what it means.
                        $gloss = $withGloss ? $view->ValueGloss($value) : '';
                        if ($gloss !== '' && $gloss !== $label) {
                            $entry['gloss'] = $gloss;
                        }
                        $out[] = $entry;
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
            $view->IntegrationWarning($resource, 'citation', $e);
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
        // DRE-SEO 0.11 cites an authority record as an entry of the database
        // ("Aas, Norbert." Person record. AMIRA. Last modified …) and says so
        // with `citeAs`. That citation is true of the record, so the panel may
        // offer it as one; without it (an older module) the framing stays honest.
        $isEntry = $isAuthority && ($cite['citeAs'] ?? null) === 'entry' && $citeStyles;
        $panelTitle = $isAuthority && !$isEntry ? $translate('This record') : $translate('Cite this record');
        $copyLabel = $isAuthority && !$isEntry ? $translate('Copy link') : $translate('Copy citation');

        $doiValues = $displayValues('bibo:doi');
        $licence = $displayValues('dcterms:license');
        $accessRights = $displayValues('dcterms:accessRights', true);
        $dreId = $displayValues('dre:id');

        // A bare DOI string is still a resolvable link.
        foreach ($doiValues as $i => $doiValue) {
            if ($doiValue['href'] === '' && preg_match('~^10\.\d{4,9}/\S+$~', $doiValue['label'])) {
                $doiValues[$i]['href'] = 'https://doi.org/' . $doiValue['label'];
            }
        }

        // The page URL, absolute. It stays what the shortlist stores and what a
        // reader navigates to; it is no longer what the rail tells them to cite.
        try {
            $permalink = (string) $resource->url(null, true);
        } catch (\Throwable $e) {
            $permalink = '';
        }

        // DRE Linked Data mints a persistent identifier, {base}/resource/{id},
        // which 303s to this page and survives a site slug or route change. With
        // the module it is the "Permanent link" and the thing every copy button
        // hands over; without it (absent, older, failing, or a record that is
        // not public) the page URL serves, as it always has.
        $linkedData = $view->RecordLinkedData($resource);
        $identifier = ($linkedData['uri'] ?? '') ?: $permalink;

        // DRE-SEO's styles already end in the identifier ("… Last modified
        // October 11, 2026. https://…/resource/1845."). A row repeating the same
        // URL under the citation only made the reader wonder which one to use;
        // the "Copy link" action still hands it over on its own.
        $citationShowsIdentifier = $identifier !== '' && (
            str_contains((string) ($citeStyles[$citeDefault]['html'] ?? ''), $identifier)
            || (!$citeStyles && str_contains($citation, $identifier))
        );

        $rows = [];
        if ($doiValues) {
            $rows[] = ['label' => $translate('DOI'), 'values' => $doiValues];
        }
        if ($identifier !== '' && !$citationShowsIdentifier) {
            // Stacked: a URL beside its label, plus a copy button, does not fit
            // the right-aligned token treatment of a DOI.
            $rows[] = ['label' => $translate('Permanent link'), 'layout' => 'block', 'values' => [['label' => $identifier, 'href' => $identifier, 'copy' => $translate('Copy permanent link')]]];
        }
        // Linked data formats and external identities sit with the identifier
        // they describe. A DOI already in its own row is not repeated as "Same as".
        foreach ($view->plugin('RecordLinkedData')->rows($linkedData, array_column($doiValues, 'href')) as $row) {
            $rows[] = $row;
        }
        // `dcterms:license` is the licence of the material the record describes.
        // The record itself is CC0, and a bare "Licence" beside its citation and
        // permanent link read as the licence of the description.
        if ($licence) {
            $rows[] = ['label' => $translate('Licence of the material'), 'values' => $licence];
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
        if ($isEntry) {
            // The entry citation already ends in the permalink; record.js copies
            // the style on screen, and this is the same text without script.
            $copyText = trim(html_entity_decode(strip_tags((string) ($citeStyles[$citeDefault]['html'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?: $identifier;
        } elseif ($isAuthority) {
            $copyText = $identifier;
        } else {
            $copyText = $citation;
            if ($copyText === '') {
                try {
                    $copyText = trim($resource->displayTitle() . ($identifier !== '' ? '. ' . $identifier : ''));
                } catch (\Throwable $e) {
                    $copyText = $identifier;
                }
            }
        }

        // A licence entered as prose — "Educational, research, criticism, and review
        // purposes only." — is a sentence, not a token, and the right-aligned bold
        // treatment that suits a DOI turns it into a ragged bold block. Stack those,
        // and any row whose value carries a gloss. Rows that set their own layout
        // (the linked-data formats, a line of short links) keep it.
        foreach ($rows as $i => $row) {
            if (isset($row['layout'])) {
                continue;
            }
            $long = count($row['values']) > 1;
            foreach ($row['values'] as $value) {
                if (mb_strlen($value['label']) > 40 || isset($value['gloss'])) {
                    $long = true;
                }
            }
            $rows[$i]['layout'] = $long ? 'block' : 'token';
        }
        // Copying the link is an action beside "Copy citation" and "Save record",
        // not a small button wedged after a wrapping URL. On an authority record
        // that is not cited as an entry, the main action already is "Copy link".
        $copyLink = ($identifier !== '' && !($isAuthority && !$isEntry)) ? $identifier : '';
        // In the rail the actions row always offers the link, so the permanent
        // link row (when shown) carries no copy button of its own.
        $copyInRow = false;

        return compact('citation', 'citeStyles', 'citeDefault', 'citeDownloads', 'citeId', 'panelTitle', 'copyLabel', 'copyText', 'copyLink', 'permalink', 'identifier', 'rows', 'copyInRow');
    }
}
