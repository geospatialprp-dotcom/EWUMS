/** Build a phone-scannable URL that opens the O&M asset in the app after login. */
export function buildOmAssetScanUrl(asset: { id: string; assetCode: string }): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    asset: asset.id,
    code: asset.assetCode,
  });
  return `${origin}/om?${params.toString()}`;
}

/** Prefer stored payload when it is already a URL; otherwise build scan link. */
export function resolveOmAssetQrValue(asset: { id: string; assetCode: string; qrCode?: string | null }): string {
  const stored = asset.qrCode?.trim();
  if (stored && /^https?:\/\//i.test(stored)) return stored;
  return buildOmAssetScanUrl(asset);
}
