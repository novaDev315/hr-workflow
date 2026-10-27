import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Command, Search, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type WorkspaceNavigationItem = {
  name: string;
  description: string;
  href: string;
  icon: typeof Search;
  keywords?: string;
};

type WorkspaceSwitcherProps = {
  items: WorkspaceNavigationItem[];
};

export function WorkspaceSwitcher({ items }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === "/" && !isTyping) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) =>
        `${item.name} ${item.description} ${item.keywords ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : items;
  const activeItem = filteredItems[Math.min(activeIndex, filteredItems.length - 1)];

  // Keep the highlighted page in view while moving with the arrow keys.
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, query]);

  const handleListKeys = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const last = filteredItems.length - 1;
    if (last < 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index >= last ? 0 : index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? last : index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(last);
    } else if (event.key === "Enter" && activeItem) {
      event.preventDefault();
      setOpen(false);
      navigate(activeItem.href);
    }
  };

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger asChild>
        <button className="app-workspace-search" type="button">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Go to a page</span>
          <span className="sm:hidden">Go to</span>
          <span className="ml-auto hidden items-center gap-1 rounded-md border border-border/80 bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
            <Command className="h-2.5 w-2.5" />K
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="app-command-panel fixed left-1/2 top-[12vh] z-[71] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden focus:outline-none">
          <Dialog.Title className="sr-only">Go to a page</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search and open an HRFlow Pro page.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b border-border/80 p-3">
            <Search className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              aria-activedescendant={
                activeItem ? `page-option-${activeItem.href}` : undefined
              }
              aria-autocomplete="list"
              aria-controls="page-options"
              aria-expanded
              aria-label="Search pages"
              className="h-11 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleListKeys}
              placeholder="Search people, payroll, work sites…"
              ref={inputRef}
              role="combobox"
              value={query}
            />
            <Dialog.Close asChild>
              <Button
                aria-label="Close page switcher"
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div
            className="max-h-[min(60vh,460px)] overflow-y-auto p-2"
            id="page-options"
            ref={listRef}
            role="listbox"
            aria-label="Pages"
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <Link
                  aria-selected={item === activeItem}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-primary/10"
                  id={`page-option-${item.href}`}
                  key={item.href}
                  onClick={() => setOpen(false)}
                  onMouseMove={() => setActiveIndex(filteredItems.indexOf(item))}
                  role="option"
                  tabIndex={-1}
                  to={item.href}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground group-hover:text-primary group-aria-selected:text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary group-aria-selected:translate-x-0.5 group-aria-selected:text-primary" />
                </Link>
              ))
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No page found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another name, such as payroll or work sites.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border/70 bg-secondary/45 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">↑ ↓</span> to move ·
            Enter to open · <span className="font-mono text-foreground">/</span>{" "}
            anywhere to search · Escape to close
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
