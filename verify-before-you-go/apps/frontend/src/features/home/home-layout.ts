export interface HomeLayout {
  wide: boolean;
  tablet: boolean;
  actionWidth: 'equal-flex';
  featureWidth: '100%';
  utilityWidth: '100%';
}

export function getHomeLayout(width: number): HomeLayout {
  const wide = false;
  const tablet = width >= 680;

  return {
    wide,
    tablet,
    actionWidth: 'equal-flex',
    featureWidth: '100%',
    utilityWidth: '100%',
  };
}
