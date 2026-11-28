// Pure helpers shared by views and regression tests; no database writes.
export const searchText = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
  .toLocaleLowerCase('vi').trim().replace(/\s+/g, ' ');
export const containsText = (value, query) => searchText(value).includes(searchText(query));
export const compareId = (a, b) => String(a._id).localeCompare(String(b._id));

// A response may commit only while it is the latest request, including retries.
export function latestRequest() {
  let version = 0;
  return () => { const current = ++version; return () => current === version; };
}
