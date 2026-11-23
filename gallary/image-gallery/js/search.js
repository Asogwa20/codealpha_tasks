export function normalize(str) {
  return (str || '').toString().toLowerCase().trim();
}

export function imageMatchesQuery(image, query) {
  const q = normalize(query);
  if (!q) return true;
  const hay = [
    image.title,
    image.description,
    image.category,
    image.originalName,
    ...(image.tags || [])
  ].map(normalize).join(' ');
  return hay.includes(q);
}

export function applyGalleryFilters(images, { query = '', category = '', tag = '', sort = 'newest' } = {}) {
  let result = images.filter((img) => !img.deleted);
  if (query) result = result.filter((img) => imageMatchesQuery(img, query));
  if (category) result = result.filter((img) => normalize(img.category) === normalize(category));
  if (tag) result = result.filter((img) => (img.tags || []).some((t) => normalize(t) === normalize(tag)));

  const sorted = [...result];
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case 'name-asc':
      sorted.sort((a, b) => normalize(a.title).localeCompare(normalize(b.title)));
      break;
    case 'name-desc':
      sorted.sort((a, b) => normalize(b.title).localeCompare(normalize(a.title)));
      break;
    case 'size-desc':
      sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return sorted;
}

export function collectCategories(images) {
  const set = new Set();
  images.forEach((img) => { if (img.category) set.add(img.category.trim()); });
  return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function collectTags(images) {
  const set = new Set();
  images.forEach((img) => (img.tags || []).forEach((t) => { if (t) set.add(t.trim()); }));
  return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
