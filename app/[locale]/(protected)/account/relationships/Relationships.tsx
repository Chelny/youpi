"use client";

import { ChangeEvent, InputEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { Prisma } from "db/browser";
import { RelationshipType } from "db/enums";
import useSWRInfinite from "swr/infinite";
import AlertMessage from "@/components/ui/AlertMessage";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input, { InputImperativeHandle } from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { SortIcon } from "@/components/ui/SortIcon";
import { PAGINATION_LIMIT } from "@/constants/api";
import { Session } from "@/lib/auth-client";
import { fetcher } from "@/lib/fetcher";
import { UserRelationshipTableRow } from "@/types/prisma";
import { createDateFormatter } from "@/utils/date";

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id: NodeJS.Timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const sp: URLSearchParams = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    sp.set(k, v);
  }

  const s: string = sp.toString();
  return s ? `?${s}` : "";
}

type RelationshipsProps = {
  session: Session | null
};

export function Relationships({ session }: RelationshipsProps): ReactNode {
  const { i18n, t } = useLingui();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterSearchUsernameRef = useRef<InputImperativeHandle>(null);

  const userId: string | undefined = session?.user.id;

  const urlQuery: string = searchParams.get("query") ?? "";
  const urlType: string = searchParams.get("type") ?? "";
  const urlMuted: string = searchParams.get("muted") ?? "";
  const urlOrderBy: string = searchParams.get("orderBy") ?? "createdAt";
  const urlSort: Prisma.SortOrder = (searchParams.get("sort") as Prisma.SortOrder) ?? Prisma.SortOrder.desc;

  const [query, setQuery] = useState<string>(urlQuery);
  const debouncedQuery = useDebouncedValue<string>(query, 300);

  const [type, setType] = useState<string>(urlType);
  const [muted, setMuted] = useState<string>(urlMuted);
  const [orderBy, setOrderBy] = useState<string>(urlOrderBy);
  const [sortOrder, setSortOrder] = useState<Prisma.SortOrder>(urlSort);

  useEffect(() => setQuery(urlQuery), [urlQuery]);
  useEffect(() => setType(urlType), [urlType]);
  useEffect(() => setMuted(urlMuted), [urlMuted]);
  useEffect(() => setOrderBy(urlOrderBy), [urlOrderBy]);
  useEffect(() => setSortOrder(urlSort), [urlSort]);

  useEffect(() => {
    const next: string = buildQueryString({
      query: debouncedQuery || undefined,
      type: type || undefined,
      muted: muted || undefined,
      orderBy: orderBy || undefined,
      sort: sortOrder || undefined,
      page: undefined,
    });

    router.replace(`${pathname}${next}`);
  }, [debouncedQuery, type, muted, orderBy, sortOrder, pathname, router]);

  const getKey = (pageIndex: number, previousPageData?: ApiResponse<UserRelationshipTableRow[]>) => {
    if (!userId) return null;

    if (previousPageData?.pagination && !previousPageData.pagination.hasNextPage) return null;

    const currentPage: number = pageIndex + 1;

    const qs: string = buildQueryString({
      query: debouncedQuery || undefined,
      type: type || undefined,
      muted: muted || undefined,
      orderBy: orderBy || undefined,
      sort: sortOrder || undefined,
      page: String(currentPage),
      limit: String(PAGINATION_LIMIT),
    });

    return `/api/users/${userId}/relationships${qs}`;
  };

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<
    ApiResponse<UserRelationshipTableRow[]>
  >(getKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const rows: UserRelationshipTableRow[] = useMemo(() => {
    if (!data) return [];
    return data.flatMap((response: ApiResponse<UserRelationshipTableRow[]>) => response.data ?? []);
  }, [data]);

  const pagination: Pagination | undefined = useMemo(() => {
    const last: ApiResponse<UserRelationshipTableRow[]> | undefined = data?.[data.length - 1];
    return last?.pagination;
  }, [data]);

  const hasNextPage: boolean = pagination?.hasNextPage ?? false;

  const handleLoadMore = async (): Promise<void> => {
    if (!hasNextPage) return;
    await setSize(size + 1);
  };

  const handleReset = async (): Promise<void> => {
    filterSearchUsernameRef.current?.clear();
    setQuery("");
    setType("");
    setMuted("");
    setOrderBy("createdAt");
    setSortOrder("desc");
    await mutate();
  };

  const formatDate = useMemo(
    () => createDateFormatter(i18n, { dateStyle: "medium", timeStyle: "short" }),
    [i18n.locale],
  );

  const handleSort = (key: "username" | "createdAt"): void => {
    if (orderBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(key);
      setSortOrder("asc");
    }
  };

  const patchRelationship = async (
    id: string,
    data: Partial<Pick<UserRelationshipTableRow, "type" | "isMuted">>,
  ): Promise<void> => {
    await mutate((pages: ApiResponse<UserRelationshipTableRow[]>[] | undefined) => {
      if (!pages) return pages;

      const nextPages = pages.map((page: ApiResponse<UserRelationshipTableRow[]>) => ({
        ...page,
        data: (page.data ?? [])
          .map((urtr: UserRelationshipTableRow) => (urtr.id === id ? { ...urtr, ...data } : urtr))
          .filter((urtr: UserRelationshipTableRow) => !(urtr.type === RelationshipType.NONE && !urtr.isMuted)),
      }));

      return nextPages;
    }, false);

    const response: Response = await fetch(`/api/users/${userId}/relationships`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });

    if (!response.ok) {
      await mutate();
      return;
    }

    await mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-12 items-center">
        <div className="md:col-span-5">
          <Input
            ref={filterSearchUsernameRef}
            id="filterSearchUsername"
            type="search"
            label={t({ message: "Search users" })}
            placeholder={t({ message: "Search by username..." })}
            defaultValue={query}
            required
            dataTestId="relationships-filter_search_username"
            onInput={(event: InputEvent<HTMLInputElement>) => setQuery(event.currentTarget.value)}
          />
        </div>

        <div className="md:col-span-3">
          <Select
            id="filterRelationshipType"
            label={t({ message: "Relation Type" })}
            defaultValue={type}
            required
            disabled={isLoading || isValidating}
            dataTestId="relationships-filter_select_type"
            onChange={(value: string) => setType(value)}
          >
            <Select.Option value="">
              <Trans>All</Trans>
            </Select.Option>
            <Select.Option value={RelationshipType.FOLLOWING}>
              <Trans>Following</Trans>
            </Select.Option>
            <Select.Option value={RelationshipType.FAVORITE}>
              <Trans>Favorite</Trans>
            </Select.Option>
            <Select.Option value={RelationshipType.BLOCKED}>
              <Trans>Blocked</Trans>
            </Select.Option>
            <Select.Option value={RelationshipType.NONE}>
              <Trans>None</Trans>
            </Select.Option>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Select
            id="filterIsMuted"
            label={t({ message: "Muted" })}
            defaultValue={muted}
            required
            disabled={isLoading || isValidating}
            dataTestId="relationships-filter_select_muted"
            onChange={(value: string) => setMuted(value)}
          >
            <Select.Option value="">
              <Trans>All</Trans>
            </Select.Option>
            <Select.Option value="true">
              <Trans>Muted</Trans>
            </Select.Option>
            <Select.Option value="false">
              <Trans>Not muted</Trans>
            </Select.Option>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Button
            type="button"
            className="mt-2"
            disabled={isLoading || isValidating}
            dataTestId="relationships-filter_button_reset"
            onClick={handleReset}
          >
            <Trans>Reset</Trans>
          </Button>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <AlertMessage type="error">
          <Trans>Failed to load relationships.</Trans>
        </AlertMessage>
      )}

      {/* Table */}
      <div className={clsx("rounded-lg border border-gray-200", "dark:border-dark-card-border")}>
        <table className="w-full text-sm">
          <thead className={clsx("sticky top-0 z-sticky bg-gray-100", "dark:bg-dark-card-background")}>
            <tr className="text-left">
              <th className="p-3">
                <div
                  className="inline-flex items-center gap-2 cursor-pointer select-none"
                  role="button"
                  tabIndex={0}
                  data-testid="relationships-table_heading_username"
                  onClick={() => handleSort("username")}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      handleSort("username");
                    }
                  }}
                >
                  <span>
                    <Trans>Username</Trans>
                  </span>
                  <SortIcon isActive={orderBy === "username"} direction={sortOrder} variant="alpha" />
                </div>
              </th>
              <th className="p-3">
                <Trans>Relation Type</Trans>
              </th>
              <th className="p-3">
                <Trans>Muted</Trans>
              </th>
              <th className="p-3">
                <div
                  className="inline-flex items-center gap-2 cursor-pointer select-none"
                  role="button"
                  tabIndex={0}
                  data-testid="relationships-table_heading_date"
                  onClick={() => handleSort("createdAt")}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      handleSort("createdAt");
                    }
                  }}
                >
                  <span>
                    <Trans>Date</Trans>
                  </span>
                  <SortIcon isActive={orderBy === "createdAt"} direction={sortOrder} variant="generic" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading && rows.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={4}>
                  <Trans>Loading...</Trans>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={4}>
                  <Trans>No results</Trans>
                </td>
              </tr>
            ) : (
              rows.map((row: UserRelationshipTableRow, index: number) => {
                return (
                  <tr
                    key={row.id}
                    className={clsx(
                      "border-t border-gray-200",
                      "hover:bg-gray-100",
                      "dark:border-dark-card-border dark:hover:bg-black/10",
                    )}
                  >
                    <td className="p-3">{row.targetUser.username}</td>

                    <td className="p-3">
                      <Select
                        id={`relationship_type_${row.id}`}
                        defaultValue={row.type}
                        isNoBottomSpace
                        dataTestId={`relationships-table_[${index}]_select_type`}
                        onChange={(value: string) => patchRelationship(row.id, { type: value as RelationshipType })}
                      >
                        <Select.Option value={RelationshipType.FOLLOWING}>
                          <Trans>Following</Trans>
                        </Select.Option>
                        <Select.Option value={RelationshipType.FAVORITE}>
                          <Trans>Favorite</Trans>
                        </Select.Option>
                        <Select.Option value={RelationshipType.BLOCKED}>
                          <Trans>Blocked</Trans>
                        </Select.Option>
                        <Select.Option value={RelationshipType.NONE}>
                          <Trans>None</Trans>
                        </Select.Option>
                      </Select>
                    </td>

                    <td className="p-3">
                      <Checkbox
                        id={`muted_${row.id}`}
                        label={undefined}
                        defaultChecked={row.isMuted}
                        isNoBottomSpace
                        dataTestId={`relationships-table_[${index}]_checkbox_muted`}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          patchRelationship(row.id, { isMuted: event.currentTarget.checked })
                        }
                      />
                    </td>

                    <td className="p-3">{formatDate(row.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-muted-foreground text-sm">
          {pagination ? (
            <>
              <Trans>Page</Trans> {pagination.currentPage} / {pagination.totalPages} ·{" "}
              <Plural
                value={pagination.totalResults}
                zero={"No results"}
                one={`${pagination.totalResults} result`}
                other={`${pagination.totalResults} results`}
              />
            </>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button type="button" disabled={!hasNextPage || isLoading || isValidating} onClick={handleLoadMore}>
            <Trans>Load more</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
