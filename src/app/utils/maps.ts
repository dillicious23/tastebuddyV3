import { Capacitor } from '@capacitor/core';

export function openNativeMap(restaurant: { name: string; address?: string; lat?: number; lng?: number }): void {
  const platform = Capacitor.getPlatform();
  const hasCoords = restaurant.lat !== undefined && restaurant.lng !== undefined;
  
  // Combine name and address to force an EXACT match, avoiding generic 'search lists'
  const searchQuery = restaurant.address 
    ? `${restaurant.name}, ${restaurant.address}` 
    : restaurant.name;

  if (platform === 'ios') {
    // Apple Maps natively handles the search query, falling back precisely if we have coordinates
    let url = `maps://?q=${encodeURIComponent(searchQuery)}`;
    if (hasCoords) url += `&ll=${restaurant.lat},${restaurant.lng}`;
    window.open(url, '_system');
  } else if (platform === 'android') {
    // Google Maps Android intent
    let url = `geo:0,0?q=${encodeURIComponent(searchQuery)}`;
    
    // If we don't have an address, force Google Maps to drop a pin precisely at the coordinates
    // and label it with the restaurant name. This completely bypasses the 'multiple results' view.
    if (!restaurant.address && hasCoords) {
      url = `geo:0,0?q=${restaurant.lat},${restaurant.lng}(${encodeURIComponent(restaurant.name)})`;
    }
    
    window.open(url, '_system');
  } else {
    // Web fallback
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
    window.open(url, '_blank');
  }
}


