/** Strict output values for CotizaFlow Pro's generated printable HTML. */
export const safeBrandColor = value =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#123a52';

export const safeBrandLogo = value =>
  typeof value === 'string' &&
  value.length <= 160040 &&
  /^data:image\/(?:png|jpeg);base64,[a-z0-9+/]+={0,2}$/i.test(value)
    ? value : '';
