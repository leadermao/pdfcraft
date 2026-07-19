'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, Menu, X, Command, Github, ChevronDown } from 'lucide-react';
import { type Locale } from '@/lib/i18n/config';
import { Button } from '@/components/ui/Button';
import { RecentFilesDropdown } from '@/components/common/RecentFilesDropdown';
import { searchTools, SearchResult } from '@/lib/utils/search';
import { getToolContent } from '@/config/tool-content';
import { getAllTools, getToolsByCategory } from '@/config/tools';
import { getToolIcon as getToolLucideIcon } from '@/config/icons';
import { TOOL_CATEGORIES, type ToolCategory } from '@/types/tool';

/** How many tools to preview per category inside the desktop mega-menu. */
const MEGA_MENU_TOOLS_PER_CATEGORY = 8;

/** Maps a tool category id to its `home.categories.*` i18n key (same mapping the /tools page uses). */
const CATEGORY_TRANSLATION_KEYS: Record<ToolCategory, string> = {
  'edit-annotate': 'editAnnotate',
  'convert-to-pdf': 'convertToPdf',
  'convert-from-pdf': 'convertFromPdf',
  'organize-manage': 'organizeManage',
  'optimize-repair': 'optimizeRepair',
  'secure-pdf': 'securePdf',
};

export interface HeaderProps {
  locale: Locale;
  showSearch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ locale, showSearch = true }) => {
  const t = useTranslations('common');
  // Root-scoped translations for the mega-menu (category names live under `home.*`, not `common.*`).
  const tHome = useTranslations('home');
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [localizedTools, setLocalizedTools] = useState<Record<string, { title: string; description: string }>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const megaMenuNavRef = useRef<HTMLElement>(null);
  const toolsTriggerRef = useRef<HTMLAnchorElement>(null);
  const megaMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load localized tool content on mount
  useEffect(() => {
    const allTools = getAllTools();
    const contentMap: Record<string, { title: string; description: string }> = {};

    allTools.forEach(tool => {
      const content = getToolContent(locale, tool.id);
      if (content) {
        contentMap[tool.id] = {
          title: content.title,
          description: content.metaDescription
        };
      }
    });

    setLocalizedTools(contentMap);
  }, [locale]);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchTools(searchQuery, localizedTools); // Pass localized content
      setSearchResults(results.slice(0, 8)); // Limit to 8 results
      setSelectedIndex(-1);
    } else {
      setSearchResults([]);
      setSelectedIndex(-1);
    }
  }, [searchQuery, localizedTools]);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSearchOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        navigateToTool(searchResults[selectedIndex].tool.slug);
      } else if (searchResults.length > 0) {
        navigateToTool(searchResults[0].tool.slug);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [searchResults, selectedIndex]);

  const navigateToTool = useCallback((slug: string) => {
    router.push(`/${locale}/tools/${slug}`);
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [locale, router]);

  const handleSearchToggle = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
    if (!isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isSearchOpen]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // Desktop "工具" mega-menu: open on hover/focus, close on leave/blur/Esc with a small
  // delay so the pointer can travel the gap between the trigger and the panel.
  const openMegaMenu = useCallback(() => {
    if (megaMenuTimer.current) {
      clearTimeout(megaMenuTimer.current);
      megaMenuTimer.current = null;
    }
    setIsMegaMenuOpen(true);
  }, []);

  const closeMegaMenu = useCallback(() => {
    if (megaMenuTimer.current) {
      clearTimeout(megaMenuTimer.current);
      megaMenuTimer.current = null;
    }
    setIsMegaMenuOpen(false);
  }, []);

  const scheduleCloseMegaMenu = useCallback(() => {
    if (megaMenuTimer.current) clearTimeout(megaMenuTimer.current);
    megaMenuTimer.current = setTimeout(() => setIsMegaMenuOpen(false), 150);
  }, []);

  // Clean up any pending close timer on unmount.
  useEffect(() => () => {
    if (megaMenuTimer.current) clearTimeout(megaMenuTimer.current);
  }, []);

  const handleMegaMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMegaMenu();
      toolsTriggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = Array.from(
        e.currentTarget.querySelectorAll<HTMLAnchorElement>('a[data-mega-item]')
      );
      if (items.length === 0) return;
      e.preventDefault();
      const current = items.findIndex((el) => el === document.activeElement);
      let next = e.key === 'ArrowDown' ? current + 1 : current - 1;
      if (next < 0) next = items.length - 1;
      if (next >= items.length) next = 0;
      items[next]?.focus();
    }
  }, [closeMegaMenu]);

  // Close the mega-menu when focus leaves the whole nav region (keyboard tab-out).
  const handleMegaMenuBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (megaMenuNavRef.current && !megaMenuNavRef.current.contains(e.relatedTarget as Node)) {
      closeMegaMenu();
    }
  }, [closeMegaMenu]);

  // Get tool icon based on category
  const getToolIcon = (category: string) => {
    const icons: Record<string, string> = {
      'edit-annotate': '✏️',
      'convert-to-pdf': '📄',
      'convert-from-pdf': '🖼️',
      'organize-manage': '📁',
      'optimize-repair': '🔧',
      'secure-pdf': '🔒',
    };
    return icons[category] || '📄';
  };

  const navItems = [
    { href: `/${locale}`, label: t('navigation.home') },
    { href: `/${locale}/tools`, label: t('navigation.tools') },
    { href: `/${locale}/workflow`, label: t('navigation.workflow') || 'Workflow' },
    { href: `/${locale}/about`, label: t('navigation.about') },
    { href: `/${locale}/faq`, label: t('navigation.faq') },
  ];

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled
        ? 'bg-[hsl(var(--color-background))]/80 backdrop-blur-md border-b border-[hsl(var(--color-border))/0.5] shadow-sm'
        : 'bg-transparent border-transparent'
        }`}
      role="banner"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex flex-1 items-center gap-2">
            <Link
              href={`/${locale}`}
              className="group flex items-center gap-2.5 text-xl font-bold text-[hsl(var(--color-foreground))] hover:opacity-90 transition-opacity"
              aria-label={`${t('brand')} - ${t('navigation.home')}`}
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-accent))] shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <span className="font-serif text-xl tracking-tight text-[hsl(var(--color-foreground))]" data-testid="brand-name">
                {t('brand')}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav
            ref={megaMenuNavRef}
            onBlur={handleMegaMenuBlur}
            className={`relative hidden md:flex items-center gap-1 rounded-full border border-[hsl(var(--color-border))/0.4] bg-[hsl(var(--color-background))/0.5] p-1.5 backdrop-blur-sm shadow-sm transition-all duration-300 ${isSearchOpen ? 'opacity-0 translate-y-[-10px] pointer-events-none' : 'opacity-100 translate-y-0'
              }`}
            role="navigation"
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const isToolsTrigger = item.href === `/${locale}/tools`;

              if (isToolsTrigger) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center"
                    onMouseEnter={openMegaMenu}
                    onMouseLeave={scheduleCloseMegaMenu}
                  >
                    <Link
                      ref={toolsTriggerRef}
                      href={item.href}
                      className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-[hsl(var(--color-muted-foreground))] hover:text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-muted))/0.5] rounded-full transition-all"
                      aria-haspopup="true"
                      aria-expanded={isMegaMenuOpen}
                      aria-controls="tools-mega-menu"
                      onFocus={openMegaMenu}
                      onClick={closeMegaMenu}
                    >
                      {item.label}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${isMegaMenuOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-1.5 text-sm font-medium text-[hsl(var(--color-muted-foreground))] hover:text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-muted))/0.5] rounded-full transition-all"
                >
                  {item.label}
                </Link>
              );
            })}

            {/* Tools mega-menu (desktop only — rendered inside the desktop-only <nav>) */}
            {isMegaMenuOpen && (
              <div
                id="tools-mega-menu"
                role="region"
                aria-label={t('navigation.tools')}
                className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3"
                onMouseEnter={openMegaMenu}
                onMouseLeave={scheduleCloseMegaMenu}
                onKeyDown={handleMegaMenuKeyDown}
              >
                <div className="w-[min(92vw,880px)] max-h-[min(78vh,620px)] overflow-y-auto rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] p-6 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-3">
                    {TOOL_CATEGORIES.map((category) => {
                      const categoryTools = getToolsByCategory(category);
                      if (categoryTools.length === 0) return null;

                      const categoryName = tHome(`categories.${CATEGORY_TRANSLATION_KEYS[category]}`);
                      const previewTools = categoryTools.slice(0, MEGA_MENU_TOOLS_PER_CATEGORY);
                      const hasMore = categoryTools.length > MEGA_MENU_TOOLS_PER_CATEGORY;

                      return (
                        <div key={category} className="min-w-0">
                          <div className="mb-2 flex items-center gap-2 px-1">
                            <span className="text-base leading-none" aria-hidden="true">
                              {getToolIcon(category)}
                            </span>
                            <h3 className="font-serif text-sm font-semibold text-[hsl(var(--color-foreground))]">
                              {categoryName}
                            </h3>
                          </div>
                          <ul className="space-y-0.5">
                            {previewTools.map((tool) => {
                              const localized = localizedTools[tool.id];
                              const toolName = localized?.title
                                || tool.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                              const ToolIcon = getToolLucideIcon(tool.icon);

                              return (
                                <li key={tool.id}>
                                  <Link
                                    href={`/${locale}/tools/${tool.slug}`}
                                    data-mega-item
                                    onClick={closeMegaMenu}
                                    className="group/mega flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[hsl(var(--color-muted-foreground))] transition-colors hover:bg-[hsl(var(--color-muted))/0.6] hover:text-[hsl(var(--color-primary))] focus:outline-none focus-visible:bg-[hsl(var(--color-muted))/0.6] focus-visible:text-[hsl(var(--color-primary))]"
                                  >
                                    <ToolIcon
                                      className="h-4 w-4 shrink-0 text-[hsl(var(--color-muted-foreground))] transition-colors group-hover/mega:text-[hsl(var(--color-primary))]"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate">{toolName}</span>
                                  </Link>
                                </li>
                              );
                            })}
                            {hasMore && (
                              <li>
                                <Link
                                  href={`/${locale}/tools?category=${category}`}
                                  data-mega-item
                                  onClick={closeMegaMenu}
                                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[hsl(var(--color-primary))] transition-colors hover:underline"
                                >
                                  {tHome('categoriesSection.toolsCount', { count: categoryTools.length })}
                                  <ChevronDown className="h-3 w-3 -rotate-90" aria-hidden="true" />
                                </Link>
                              </li>
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-[hsl(var(--color-border))] pt-4">
                    <p className="text-xs text-[hsl(var(--color-muted-foreground))]">
                      {tHome('categoriesSection.description', { count: getAllTools().length })}
                    </p>
                    <Link
                      href={`/${locale}/tools`}
                      data-mega-item
                      onClick={closeMegaMenu}
                      className="flex shrink-0 items-center gap-1 text-sm font-medium text-[hsl(var(--color-primary))] hover:underline"
                    >
                      {tHome('categoriesSection.title')}
                      <ChevronDown className="h-3.5 w-3.5 -rotate-90" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </nav>

          {/* Right side actions */}
          <div className="flex flex-1 items-center justify-end gap-3">
            {/* Search */}
            {showSearch && (
              <div className="relative" ref={searchContainerRef}>
                {isSearchOpen ? (
                  <div className="fixed md:absolute left-4 right-4 md:left-auto md:right-0 top-[22px] md:top-1/2 md:-translate-y-1/2 z-50 md:origin-right animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="relative w-full md:w-96">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--color-muted-foreground))]" />
                      <input
                        ref={searchInputRef}
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('search.placeholder') || 'Search tools...'}
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-background))] shadow-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                        aria-label="Search tools"
                        autoComplete="off"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSearchToggle}
                        aria-label="Close search"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                      >
                        <X className="h-4 w-4 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
                      </Button>

                      {/* Search Results Dropdown */}
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[hsl(var(--color-background))] border border-[hsl(var(--color-border))] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-[60vh] overflow-y-auto">
                          <ul className="py-2" role="listbox">
                            {searchResults.map((result, index) => {
                              const localized = localizedTools[result.tool.id];
                              const toolName = localized?.title || result.tool.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                              const toolDescription = localized?.description || result.tool.features.slice(0, 3).join(' • ');

                              return (
                                <li key={result.tool.id}>
                                  <button
                                    onClick={() => navigateToTool(result.tool.slug)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`
                                      w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors
                                      ${index === selectedIndex
                                        ? 'bg-[hsl(var(--color-primary))/0.1] text-[hsl(var(--color-primary))]'
                                        : 'hover:bg-[hsl(var(--color-muted))] text-[hsl(var(--color-foreground))]'
                                      }
                                    `}
                                    role="option"
                                    aria-selected={index === selectedIndex}
                                  >
                                    <span className="text-xl filter grayscale group-hover:grayscale-0">{getToolIcon(result.tool.category)}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-sm truncate">
                                        {toolName}
                                      </div>
                                      <div className="text-xs text-[hsl(var(--color-muted-foreground))] truncate">
                                        {toolDescription}
                                      </div>
                                    </div>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSearchToggle}
                    aria-label="Open search"
                    className="relative text-[hsl(var(--color-muted-foreground))] hover:text-[hsl(var(--color-foreground))]"
                  >
                    <Search className="h-5 w-5" aria-hidden="true" />
                    <span className="ml-2 hidden lg:inline-block text-xs text-[hsl(var(--color-muted-foreground))/0.5] border border-[hsl(var(--color-border))] rounded px-1.5 py-0.5">⌘K</span>
                  </Button>
                )}
              </div>
            )}

            {/* Recent Files Dropdown */}
            <RecentFilesDropdown
              locale={locale}
              translations={{
                title: t('recentFiles.title') || 'Recent Files',
                empty: t('recentFiles.empty') || 'No recent files',
                clearAll: t('recentFiles.clearAll') || 'Clear all',
                processedWith: t('recentFiles.processedWith') || 'Processed with',
              }}
            />

            {/* GitHub Repository Link */}
            <a
              href="https://github.com/leadermao/pdfcraft"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg text-[hsl(var(--color-muted-foreground))] hover:text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-muted))/0.5] transition-all"
              aria-label="GitHub Repository"
            >
              <Github className="h-5 w-5" aria-hidden="true" />
            </a>

            {/* Language Selector placeholder */}
            <div id="language-selector-slot" />

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={handleMobileMenuToggle}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <nav
            id="mobile-menu"
            className="md:hidden py-4 border-t border-[hsl(var(--color-border))] bg-[hsl(var(--color-background))] backdrop-blur-xl shadow-lg"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <ul className="flex flex-col gap-2 p-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block px-4 py-3 text-base font-medium text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-muted))] rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              {/* GitHub Link in Mobile Menu */}
              <li>
                <a
                  href="https://github.com/leadermao/pdfcraft"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 text-base font-medium text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-muted))] rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Github className="h-5 w-5" aria-hidden="true" />
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
