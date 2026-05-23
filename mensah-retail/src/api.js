const API_BASE_URL = 'https://api-hackathon.codedematrixtech.com';
const MERCHANT_ID = 'mensah';
const TEAM_SLUG = 'likekodji';

/**
 * Prepends base URL to image paths if relative.
 */
export function formatImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}

/**
 * Fetches the merchant's active catalog/inventory.
 */
export async function fetchCatalog() {
  const res = await fetch(`${API_BASE_URL}/merchants/${MERCHANT_ID}/items`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch catalog.');
  }
  return await res.json();
}

/**
 * Fetches lookbooks/campaigns published for the merchant.
 */
export async function fetchCampaigns() {
  const res = await fetch(`${API_BASE_URL}/merchants/${MERCHANT_ID}/campaigns`);
  if (!res.ok) {
    throw new Error('Failed to fetch campaigns.');
  }
  return await res.json();
}

/**
 * Fetches details for a specific campaign, including its featured items.
 */
export async function fetchCampaignDetails(campaignId) {
  const res = await fetch(`${API_BASE_URL}/campaigns/${campaignId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch campaign details.');
  }
  return await res.json();
}

/**
 * Submits a new shopping basket/order to the backend.
 * @param {Object} basket - Basket payload.
 */
export async function submitBasket(basket) {
  const payload = {
    merchant_id: MERCHANT_ID,
    team_slug: TEAM_SLUG,
    items: basket.items.map(item => ({
      item_id: item.id,
      qty: item.qty,
      item_note: item.note || ''
    })),
    customer_name: basket.customerName || 'Anonymous Customer',
    customer_phone: basket.customerPhone || '',
    customer_note: basket.customerNote || ''
  };

  const res = await fetch(`${API_BASE_URL}/baskets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to place order.');
  }

  return await res.json(); // returns { id: 'basket_id' }
}

/**
 * Creates a brand new lookbook campaign drop.
 * @param {Object} campaign - Campaign payload.
 */
export async function createCampaign(campaign) {
  const payload = {
    merchant_id: MERCHANT_ID,
    team_slug: TEAM_SLUG,
    title: campaign.title,
    copy_text: campaign.copyText || '',
    image_urls: campaign.imageUrls || [],
    featured_item_ids: campaign.featuredItemIds || []
  };

  const res = await fetch(`${API_BASE_URL}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create campaign.');
  }

  return await res.json(); // returns { id: 'campaign_id' }
}

/**
 * Fetches live analytics and registered orders for our team.
 */
export async function fetchTeamAnalytics() {
  const res = await fetch(`${API_BASE_URL}/teams/${TEAM_SLUG}`);
  if (!res.ok) {
    throw new Error('Failed to fetch team analytics.');
  }
  return await res.json();
}

/**
 * Uploads a local file image to the server.
 * @param {File} file 
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/uploads`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to upload image.');
  }

  return await res.json(); // returns { url: '/uploads/abc123.jpg' }
}

/**
 * Rehosts a remote image onto our backend.
 * @param {string} sourceUrl 
 */
export async function rehostImage(sourceUrl) {
  const res = await fetch(`${API_BASE_URL}/uploads/rehost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_url: sourceUrl })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to rehost image.');
  }

  return await res.json(); // returns { url: '/uploads/xyz789.jpg' }
}
