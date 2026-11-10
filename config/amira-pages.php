<?php
/**
 * The AMIRA site's page slugs, and the copy the theme attaches to them.
 *
 * Read by view/common/nav-menu.phtml (the main menu's section intros and
 * child descriptions) and view/common/banner.phtml (which page each
 * collection count links to), and by the tests: the PHP suites include this
 * file, and the production smoke inventory (tests/browser/surfaces.mjs) builds
 * its page paths through scripts/lib/amira-pages.mjs, which reads it as text.
 * So keep the format: one `'slug' => "Copy",` or `'key' => 'slug',` pair per
 * line inside each named list.
 *
 * Copy is English source text. The `// @translate` markers put it in
 * language/template.pot (npm run i18n:extract); the templates translate it
 * where they print it. A page missing here still renders, just without an
 * intro or description.
 *
 * The access notices' page (`access-contact`) is RecordAccess::DEFAULT_PAGE_SLUG,
 * a theme setting's default, so it is not repeated here as a separate key.
 */
return [
    // One framing sentence per menu section, keyed by the parent page slug.
    'intros' => [
        'research'        => "Projects, sections and the primary materials they produce.", // @translate
        'index'           => "The named entities that link every record together.", // @translate
        'public-outreach' => "Public-facing media from the Cluster.", // @translate
        'visualisations'  => "Read the metadata at a glance.", // @translate
        'collections'     => "Explore the Cluster's featured collections through timelines, image galleries and maps.", // @translate
        'access-reuse'    => "How to reach the material, and how to reuse what AMIRA publishes.", // @translate
    ],

    // One short description per menu child, keyed by the child page slug.
    'descriptions' => [
        // Research
        'research-sections' => "The Cluster's thematic areas", // @translate
        'research-projects' => "Projects across the AMRCs", // @translate
        'research-items'    => "Sources, media & datasets", // @translate
        // Index
        'people'        => "Authors & named persons", // @translate
        'organisations' => "Institutions & bodies", // @translate
        'genres'        => "Document & media types", // @translate
        'languages'     => "Languages represented", // @translate
        'locations'     => "Places & georeferences", // @translate
        'subjects-tags' => "Topics & keywords", // @translate
        // Outreach
        'podcasts'       => "Audio series", // @translate
        'youtube-videos' => "Talks & recordings", // @translate
        // Visualisations
        'project-explorer'            => "Browse projects interactively", // @translate
        'compare'                     => "Projects side by side", // @translate
        'spatial-exploration'         => "Places mapped & georeferenced", // @translate
        'publications-visualisations' => "Publication trends & networks", // @translate
        'podcasts-visualisations'     => "Episode trends & transcripts", // @translate
        'youtube-visualisations'      => "Video trends & playlists", // @translate
        'networks'                    => "Knowledge-graph links", // @translate
        'semantic-map'                => "Records grouped by meaning", // @translate
        // Collections
        'international-library-of-african-music-ilam'   => "Africa's foremost music archive", // @translate
        'memorias-perifericas-capoeira-angola-salvador' => "Peripheral memories of Capoeira Angola in Salvador", // @translate
        'orixas-fundacao-gregorio-de-mattos'            => "Orishas — Gregório de Mattos Foundation", // @translate
        'trabalhadores-na-da-bahia'                     => "Workers in/from Bahia", // @translate
        // Access & reuse
        'access-contact'   => "Requesting material & who to ask", // @translate
        'linked-open-data' => "RDF, dump & CC0 metadata", // @translate
    ],

    // The page each home-banner count links to, keyed by the CollectionStats
    // metric (DRE Search's CorpusCounts::METRICS emits the same keys).
    'statPages' => [
        'researchItems' => 'research-items',
        'projects'      => 'research-projects',
        'people'        => 'people',
        'organisations' => 'organisations',
        'locations'     => 'locations',
        'languages'     => 'languages',
        'subjectsTags'  => 'subjects-tags',
        'publications'  => 'publications',
        'podcasts'      => 'podcasts',
        'youtube'       => 'youtube-videos',
    ],
];
