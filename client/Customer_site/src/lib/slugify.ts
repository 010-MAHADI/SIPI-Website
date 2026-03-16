/**
 * Utility functions for generating and parsing product URLs with slugs
 */

interface ProductUrlSource {
  id: number;
  title?: string | null;
  name?: string | null;
  meta_title?: string | null;
  category?: string | null;
  category_name?: string | null;
}

/**
 * Convert a string to a URL-friendly slug
 */
export function slugify(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') {
    return 'untitled';
  }
  
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export function getProductSlug(product: ProductUrlSource): string {
  return slugify(product.meta_title || product.title || product.name);
}

export function getProductCategorySlug(product: ProductUrlSource): string {
  return slugify(product.category_name || product.category || 'products');
}

/**
 * Generate a product URL with category and product slug, including ID for uniqueness
 */
export function generateProductUrl(product: ProductUrlSource): string {
  const productSlug = getProductSlug(product);
  const categorySlug = getProductCategorySlug(product);

  // Include product ID in the slug to ensure uniqueness
  return `/${categorySlug}/${productSlug}-${product.id}`;
}

/**
 * Extract product ID from legacy product URLs
 */
export function extractProductId(url: string): number | null {
  // Legacy format: /product/123/slug or /product/123
  const legacyMatch = url.match(/\/product\/(\d+)(?:\/.*)?$/);
  return legacyMatch ? parseInt(legacyMatch[1], 10) : null;
}

/**
 * Generate a category URL with slug
 */
export function generateCategoryUrl(category: { id: number; name?: string | null }): string {
  const slug = slugify(category.name);
  return `/category/${category.id}/${slug}`;
}

/**
 * Extract category ID from a URL slug
 */
export function extractCategoryId(url: string): number | null {
  const match = url.match(/\/category\/(\d+)(?:\/.*)?$/);
  return match ? parseInt(match[1], 10) : null;
}
