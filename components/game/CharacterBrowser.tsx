"use client";

import {
  Card,
  Label,
  Link,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Table,
} from "@heroui/react";
import React from "react";

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
  {
    id: "character",
    label: "Character",
    className: "text-muted",
    isRowHeader: true,
  },
  { id: "id", label: "Id", className: "text-muted", isRowHeader: false },
  { id: "color", label: "Color", className: "text-muted", isRowHeader: false },
  {
    id: "atk",
    label: "ATK",
    className: "text-right text-muted",
    isRowHeader: false,
  },
  {
    id: "def",
    label: "DEF",
    className: "text-right text-muted",
    isRowHeader: false,
  },
  {
    id: "hp",
    label: "HP",
    className: "text-right text-muted",
    isRowHeader: false,
  },
] as const;

const UI = {
  labelMuted: "font-body text-xs uppercase tracking-[0.16em] text-muted",
  smallMuted: "font-body text-xs uppercase tracking-[0.14em] text-muted",
  controlSurface: "rounded-none border-2 border-border bg-surface-secondary",
  selectValue: "text-foreground data-[placeholder=true]:text-muted",
  popover: "border border-border bg-surface text-foreground",
  listItem: "text-foreground hover:bg-surface-secondary",
  paginationText: "text-foreground",
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
        <SearchField
          name="characterSearch"
          value={searchValue}
          onChange={(value) => {
            setSearchValue(value);
            setCurrentPage(1);
          }}
          className="text-foreground md:col-span-2"
        >
          <Label className={UI.labelMuted}>Search</Label>
          <SearchField.Group className={UI.controlSurface}>
            <SearchField.SearchIcon className="text-muted" />
            <SearchField.Input
              placeholder="Search by name or id"
              className="text-foreground placeholder:text-muted"
            />
            <SearchField.ClearButton className="text-muted hover:bg-surface" />
          </SearchField.Group>
        </SearchField>

        <Select
          variant="secondary"
          value={selectedColor}
          onChange={(value) => {
            if (typeof value === "string") {
              setSelectedColor(value as "all" | CharacterColor);
              setCurrentPage(1);
            }
          }}
          placeholder="Filter"
        >
          <Label className={UI.labelMuted}>Filter</Label>
          <Select.Trigger className={UI.controlSurface}>
            <Select.Value className={UI.selectValue} />
            <Select.Indicator className="text-muted" />
          </Select.Trigger>
          <Select.Popover className={UI.popover}>
            <ListBox className="text-foreground">
              {COLOR_OPTIONS.map((option) => (
                <ListBox.Item
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                  className={UI.listItem}
                >
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <Card
        variant="secondary"
        className="rounded-none border-2 border-border bg-surface"
      >
        <Card.Content className="p-0">
          <Table variant="secondary" className="rounded-none">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Character browser"
                className="min-w-215 text-foreground"
              >
                <Table.Header className="bg-surface-secondary">
                  {TABLE_COLUMNS.map((column) => (
                    <Table.Column
                      key={column.id}
                      isRowHeader={column.isRowHeader}
                      className={column.className}
                    >
                      {column.label}
                    </Table.Column>
                  ))}
                </Table.Header>

                <Table.Body>
                  {pagedCharacters.length === 0 ? (
                    <Table.Row id="no-results">
                      <Table.Cell colSpan={6} className="py-8 text-center">
                        <span className="font-body text-sm uppercase tracking-[0.14em] text-muted">
                          No characters found.
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    pagedCharacters.map((character) => (
                      <Table.Row key={character.id} id={character.id}>
                        <Table.Cell>
                          <Link
                            href={`/archive/${character.id}`}
                            className="font-heading text-2xl tracking-[0.06em] text-foreground no-underline hover:underline hover:underline-offset-3"
                          >
                            {character.name}
                            <Link.Icon className="size-3" />
                          </Link>
                        </Table.Cell>
                        <Table.Cell>
                          <span className={UI.smallMuted}>{character.id}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-4 w-4 rounded-none border border-border ${colorSwatchClass(character.color)}`}
                            />
                            <span className={UI.smallMuted}>
                              {formatColor(character.color)}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <span className={UI.statValue}>{character.atk}</span>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <span className={UI.statValue}>{character.def}</span>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <span className={UI.statValue}>{character.hp}</span>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>

      <div className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-end md:justify-between">
        <Select
          variant="secondary"
          value={String(pageSize)}
          onChange={(value) => {
            if (typeof value === "string") {
              setPageSize(Number(value));
              setCurrentPage(1);
            }
          }}
          placeholder="Page Size"
          className="w-full md:max-w-45"
        >
          <Label className={UI.labelMuted}>Page Size</Label>
          <Select.Trigger className={UI.controlSurface}>
            <Select.Value className={UI.selectValue} />
            <Select.Indicator className="text-muted" />
          </Select.Trigger>
          <Select.Popover className={UI.popover}>
            <ListBox className="text-foreground">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <ListBox.Item
                  key={size}
                  id={String(size)}
                  textValue={String(size)}
                  className={UI.listItem}
                >
                  {size}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Pagination className="w-full md:w-auto" size="md">
          <Pagination.Summary>
            <span className={UI.labelMuted}>
              Showing {startItem}-{endItem} of {filteredCharacters.length}
            </span>
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={currentPage === 1}
                className={UI.paginationText}
                onPress={() => setCurrentPage((page) => page - 1)}
              >
                <Pagination.PreviousIcon />
                <span className={UI.paginationText}>Previous</span>
              </Pagination.Previous>
            </Pagination.Item>

            {paginationItems.map((page, index) =>
              page === "ellipsis" ? (
                <Pagination.Item key={`ellipsis-${index}`}>
                  <Pagination.Ellipsis />
                </Pagination.Item>
              ) : (
                <Pagination.Item key={page}>
                  <Pagination.Link
                    isActive={page === currentPage}
                    className={UI.paginationText}
                    onPress={() => setCurrentPage(page)}
                  >
                    <span className={UI.paginationText}>{page}</span>
                  </Pagination.Link>
                </Pagination.Item>
              ),
            )}

            <Pagination.Item>
              <Pagination.Next
                isDisabled={currentPage === totalPages}
                className={UI.paginationText}
                onPress={() => setCurrentPage((page) => page + 1)}
              >
                <span className={UI.paginationText}>Next</span>
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>
    </section>
  );
}
