import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
import {renderFixture, routeFixture} from './fixtures.mjs';
const html = renderFixture('header');
async function fixture(page, width, enhance = true) {
    await page.setViewportSize({width, height:850});
    await routeFixture(page, html);
    await page.goto('https://theme.test/');
    if (enhance) {
        await page.addScriptTag({path:'asset/js/navigation.js'});
        await page.addScriptTag({path:'asset/js/script.js'});
    }
}
for (const width of [320, 390]) {
    test(`navigation baseline survives a missing navigation script at ${width}`, async ({page}) => {
        await fixture(page, width, false);
        await page.addScriptTag({path:'asset/js/script.js'});
        await expect(page.locator('.main-navigation').getByRole('link', {name:'Project archive', exact:true})).toBeVisible();
        await expect(page.locator('.main-navigation__toggle')).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    });
}
// A real page sets html.js before the header. Between first paint and
// navigation.js's DOMContentLoaded init the menu must already be closed:
// v2.32 painted the whole tree expanded there, then snapped it shut.
const jsHtml = html.replace('<html lang="en">', '<html lang="en" class="js">');
for (const width of [390, 1280]) {
    test(`with JavaScript the menu paints closed before navigation.js runs at ${width}`, async ({page}) => {
        await page.setViewportSize({width, height:850});
        await routeFixture(page, jsHtml);
        await page.goto('https://theme.test/');
        const nested = page.locator('.main-navigation').getByRole('link', {name:'Project archive', exact:true});
        // No navigation.js at all: by window load the header falls back to the expanded list.
        await expect(page.locator('.main-header')).toHaveClass(/nav-failed/);
        await expect(nested).toBeVisible();
        // The window before init, when the script is merely still coming.
        await page.evaluate(() => document.querySelector('.main-header').classList.remove('nav-failed'));
        await expect(nested).toBeHidden();
        if (width < 1200) await expect(page.locator('.main-navigation__toggle')).toBeVisible();
        else await expect(page.locator('.main-navigation').getByRole('link', {name:'Research', exact:true})).toBeVisible();
    });
}
test('navigation remains usable with all JavaScript disabled', async ({browser}) => {
    const context = await browser.newContext({javaScriptEnabled:false, viewport:{width:390,height:850}});
    const page = await context.newPage();
    await routeFixture(page, html);
    await page.goto('https://theme.test/');
    await expect(page.getByRole('link',{name:'Project archive',exact:true})).toBeVisible();
    await expect(page.locator('.core-search').first().getByRole('searchbox')).toBeVisible();
    await context.close();
});
test('mobile drawer survives scrolling and resize, supports deep links, and releases focus at desktop', async ({page}) => {
    await fixture(page, 390);
    await page.addScriptTag({path:'asset/js/shortlist.js'});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const toggle = page.getByRole('button', {name:'Open menu',exact:true});
    await toggle.click();
    await page.getByRole('navigation', {name:'Mobile navigation'}).getByRole('link',{name:'Research',exact:true}).click();
    await page.getByRole('navigation', {name:'Mobile navigation'}).getByRole('link',{name:'Projects',exact:true}).click();
    await expect(page.getByRole('navigation', {name:'Mobile navigation'}).getByRole('link',{name:'Project archive',exact:true})).toBeVisible();
    await page.setViewportSize({width:390,height:750});
    await page.waitForTimeout(180);
    await expect(page.locator('.main-navigation__toggle')).toHaveAttribute('aria-expanded','true');
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await page.evaluate(() => scrollTo(0,400));
    await expect(page.locator('.main-header')).toHaveCSS('top','0px');
    await toggle.click();
    await page.setViewportSize({width:1280,height:850});
    await expect(page.locator('.main-header')).toHaveAttribute('data-nav','inline');
    await expect(page.locator('.main-navigation a').first()).toBeFocused();
    await expect(page.locator('#menu-drawer')).toHaveAttribute('inert','');
});
test('fallback search has distinct IDs, disclosure state, Escape and a GET destination', async ({page}) => {
    await fixture(page,390);
    const button = page.locator('.core-search').first().getByRole('button',{name:'Search',exact:true});
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded','true');
    const input = page.locator('.core-search').first().getByRole('searchbox');
    await expect(input).toBeFocused();
    await input.fill('Archive');
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded','false');
    await button.click();
    await input.press('Enter');
    await expect(page).toHaveURL(/index\/search\?fulltext_search=Archive/);
});
test('complete chrome passes accessibility checks at enlarged text and forced colors', async ({page}) => {
    await fixture(page,390);
    await page.emulateMedia({forcedColors:'active', reducedMotion:'reduce'});
    await page.addStyleTag({content:'html { font-size: 200%; }'});
    const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
});
test('shortlist saves, survives reload, clears with undo and exports', async ({page}) => {
    await fixture(page,1280);
    await page.addScriptTag({path:'asset/js/shortlist.js'});
    // One name per toggle, with the record's title for context; the count is
    // part of the shortlist button's name.
    await page.getByRole('button',{name:'Save record: A record',exact:true}).click();
    await expect(page.getByRole('button',{name:'Research shortlist 1',exact:true})).toBeVisible();
    await page.getByRole('button',{name:/^Research shortlist/}).click();
    await expect(page.locator('[data-shortlist-list]')).toContainText('A record');
    for (const format of ['md', 'csv', 'json']) {
        await page.locator('[data-shortlist-format]').selectOption(format);
        const download = page.waitForEvent('download');
        await page.getByRole('button',{name:'Export list',exact:true}).click();
        const file = await download;
        expect(file.suggestedFilename()).toBe(`research-shortlist.${format}`);
        const content = readFileSync(await file.path(), 'utf8');
        if (format === 'csv') expect(content.charCodeAt(0)).toBe(0xFEFF);
        expect(content).toContain('A record');
        expect(content).toContain('https://theme.test/s/a/item/1');
        if (format === 'json') expect(JSON.parse(content).records).toHaveLength(1);
    }
    await page.getByRole('button',{name:'Clear list',exact:true}).click();
    await expect(page.getByText('No saved records yet.',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Undo clear',exact:true}).click();
    await expect(page.locator('[data-shortlist-list]')).toContainText('A record');
    await page.reload();
    await page.addScriptTag({path:'asset/js/shortlist.js'});
    await expect(page.getByRole('button',{name:'Save record: A record',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('desktop overflow switches to a usable drawer', async ({page}) => {
    await fixture(page,1280);
    await page.evaluate(() => {
        const menu = document.querySelector('.main-navigation .navigation');
        for (let i=0;i<14;i++) { const item=document.createElement('li'); const link=document.createElement('a'); link.href='#content'; link.textContent='Long navigation destination '+i; item.append(link); menu.append(item); }
        window.__dreClassifyNav();
    });
    await expect(page.locator('.main-header')).toHaveAttribute('data-nav','drawer');
    await page.getByRole('button',{name:'Open menu',exact:true}).click();
    await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();
});

test('a wide menu remains in drawer mode when crossing the desktop breakpoint', async ({page}) => {
    await fixture(page,390,false);
    await page.locator('.main-navigation .navigation > li > a').evaluateAll(links => links.forEach(link => { link.textContent = 'Long section name '.repeat(12); }));
    await page.addScriptTag({path:'asset/js/navigation.js'});
    await page.setViewportSize({width:1280,height:850});
    await page.waitForTimeout(180);
    await expect(page.locator('.main-header')).toHaveAttribute('data-nav','drawer');
    await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeVisible();
});
