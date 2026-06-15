import L from 'leaflet';

/**
 * Create a custom NILIN-branded map marker icon.
 * Uses a coral background with a white price label, matching the brand palette.
 */
export function createNILINMarkerIcon(
  label: string,
  options: { isUser?: boolean; isSelected?: boolean } = {}
): L.DivIcon {
  const { isUser = false, isSelected = false } = options;

  const bg = isUser
    ? '#3B82F6' // blue for user location
    : isSelected
    ? '#2D2D2D' // charcoal for selected
    : '#E8B4A8'; // nilin-coral default

  const size = isUser ? 18 : isSelected ? 36 : 32;

  const html = isUser
    ? `<div style="
        width: ${size}px;
        height: ${size}px;
        background: ${bg};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 2px ${bg}40, 0 2px 6px rgba(0,0,0,0.3);
      "></div>`
    : `<div style="
        background: ${bg};
        color: white;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        border: 2px solid white;
        ${isSelected ? 'transform: scale(1.15);' : ''}
        transition: transform 0.2s ease;
      ">${label}</div>`;

  return L.divIcon({
    className: 'nilin-marker',
    html,
    iconSize: [size, size],
    iconAnchor: isUser ? [size / 2, size / 2] : [size / 2, size / 2 + 4],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

/**
 * Create a default user-location dot icon.
 */
export const userLocationIcon = (): L.DivIcon => createNILINMarkerIcon('', { isUser: true });

/**
 * Create a cluster icon with count badge.
 * Shows how many markers are grouped together.
 */
export function createClusterIcon(count: number): L.DivIcon {
  const size = Math.min(56, 36 + Math.min(count, 20) * 1.5);
  const fontSize = count > 99 ? 10 : count > 9 ? 12 : 14;

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: linear-gradient(135deg, #E8B4A8 0%, #D4958A 100%);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${fontSize}px;
      font-weight: 700;
      box-shadow: 0 3px 12px rgba(0,0,0,0.3);
      border: 3px solid white;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    "
    onmouseover="this.style.transform='scale(1.1)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.35)';"
    onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 3px 12px rgba(0,0,0,0.3)';"
    >
      ${count > 99 ? '99+' : count}
    </div>
  `;

  return L.divIcon({
    className: 'nilin-cluster',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}
