"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CharacterColor = "light" | "red" | "blue" | "green" | "dark";

export interface CharacterBrowserItem {
  id: string;
  name: string;
  color: CharacterColor;
  atk: number;
  def: number;
  hp: number;
}

interface CharacterBrowserProps {
  characters: CharacterBrowserItem[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const COLOR_OPTIONS: Array<{ id: "all" | CharacterColor; label: string }> = [
  { id: "all", label: "All" },
  { id: "light", label: "Light" },
  { id: "red", label: "Red" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "dark", label: "Dark" },
];

const TABLE_COLUMNS = [
  { id: "character", label: "Character", className: "" },
  { id: "id", label: "Id", className: "" },
  { id: "color", label: "Color", className: "" },
  { id: "atk", label: "ATK", className: "text-right" },
  { id: "def", label: "DEF", className: "text-right" },
  { id: "hp", label: "HP", className: "text-right" },
] as const;

const UI = {
  labelMuted:
    "font-body text-xs uppercase tracking-[0.16em] text-muted-foreground",
  smallMuted:
    "font-body text-xs uppercase tracking-[0.14em] text-muted-foreground",
  controlSurface: "rounded-none border-2 border-border bg-muted/30",
  statValue: "font-heading text-xl text-foreground",
} as const;

function colorSwatchClass(color: CharacterColor): string {
  switch (color) {
    case "light":
      return "bg-zinc-100";
    case "red":
      return "bg-red-500";
    case "blue":
      return "bg-sky-500";
    case "green":
      return "bg-emerald-500";
    case "dark":
      return "bg-violet-500";
    default:
      return "bg-zinc-300";
  }
}

function formatColor(color: CharacterColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function getPaginationItems(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];

  if (currentPage > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (currentPage < totalPages - 2) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

export default function CharacterBrowser({
  characters,
}: CharacterBrowserProps): React.JSX.Element {
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState<
    "all" | CharacterColor
  >("all");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [currentPage, setCurrentPage] = React.useState<number>(1);

  const filteredCharacters = React.useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();

    return characters.filter((character) => {
      const matchesSearch =
        normalized.length === 0 ||
        character.name.toLowerCase().includes(normalized) ||
        character.id.toLowerCase().includes(normalized);
      const matchesColor =
        selectedColor === "all" || character.color === selectedColor;

      return matchesSearch && matchesColor;
    });
  }, [characters, searchValue, selectedColor]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCharacters.length / pageSize),
  );

  // Ensure we never set state synchronously during render. Adjust page if out of bounds.
  React.useEffect(() => {
    if (currentPage > totalPages) {
      // Defer state update to next tick to avoid React warning.
      setTimeout(() => setCurrentPage(totalPages), 0);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const pagedCharacters = filteredCharacters.slice(
    startIndex,
    startIndex + pageSize,
  );
  const startItem = filteredCharacters.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, filteredCharacters.length);
  const paginationItems = getPaginationItems(currentPage, totalPages);

  return (
    <section className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="characterSearch" className={UI.labelMuted}>
            Search
          </Label>
          <Input
            id="characterSearch"
            name="characterSearch"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name or id"
            className={`${UI.controlSurface} text-foreground placeholder:text-muted-foreground`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className={UI.labelMuted}>Filter</Label>
          <Select
            value={selectedColor}
            onValueChange={(value) => {
              setSelectedColor(value as "all" | CharacterColor);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className={`${UI.controlSurface} w-full`}>
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-none border-2 border-border bg-card ring-0">
        <CardContent className="p-0">
          <Table className="min-w-215 text-foreground">
            <TableHeader className="bg-muted/30">
              <TableRow>
                {TABLE_COLUMNS.map((column) => (
                  <TableHead
                    key={column.id}
                    className={`text-muted-foreground ${column.className}`}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {pagedCharacters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <span className="font-body text-sm uppercase tracking-[0.14em] text-muted-foreground">
                      No characters found.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                pagedCharacters.map((character) => (
                  <TableRow key={character.id}>
                    <TableCell>
                      <Link
                        href={`/archive/${character.id}`}
                        className="font-heading text-2xl tracking-[0.06em] text-foreground no-underline hover:underline hover:underline-offset-3"
                      >
                        {character.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className={UI.smallMuted}>{character.id}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-4 w-4 rounded-none border border-border ${colorSwatchClass(character.color)}`}
                        />
                        <span className={UI.smallMuted}>
                          {formatColor(character.color)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={UI.statValue}>{character.atk}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={UI.statValue}>{character.def}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={UI.statValue}>{character.hp}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-end md:justify-between">
        <div className="flex w-full flex-col gap-2 md:max-w-45">
          <Label className={UI.labelMuted}>Page Size</Label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className={`${UI.controlSurface} w-full`}>
              <SelectValue placeholder="Page Size" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
          <span className={UI.labelMuted}>
            Showing {startItem}-{endItem} of {filteredCharacters.length}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => page - 1)}
            >
              Previous
            </Button>

            {paginationItems.map((page, index) =>
              page === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={page}
                  variant={page === currentPage ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ),
            )}

            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
