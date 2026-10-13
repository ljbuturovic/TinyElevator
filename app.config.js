export default ({ config }) => {
  if (process.env.APP_VARIANT !== 'development') return config;

  return {
    ...config,
    name: 'TinyElevator Dev',
    scheme: 'tinyelevator-dev',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.ljubomirbuturovic.tinyelevator.dev',
    },
  };
};
