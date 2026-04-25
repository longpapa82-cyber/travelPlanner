/**
 * V178 (Issue 3): native LicensesScreen data, mirroring the previous
 * https://mytravel-planner.com/licenses.html page so the app no longer
 * needs an external browser hop for OSS attribution. Source of truth
 * lives here — the public/licenses.html static page can be retired or
 * kept in sync manually.
 */

export interface LicensePackage {
  name: string;
  license: string;
  url: string;
  attribution?: string;
}

export interface LicenseSection {
  title: string;
  packages: LicensePackage[];
}

export interface LicenseSummary {
  spdx: string;
  count: number;
}

export const LICENSE_SUMMARY: LicenseSummary[] = [
  { spdx: 'MIT', count: 889 },
  { spdx: 'ISC', count: 39 },
  { spdx: 'Apache-2.0', count: 31 },
  { spdx: 'BSD-3-Clause', count: 26 },
  { spdx: 'BSD-2-Clause', count: 17 },
  { spdx: 'Other (BlueOak, MPL, Unlicense, etc.)', count: 20 },
];

export const LICENSE_SECTIONS: LicenseSection[] = [
  {
    title: 'Core Framework',
    packages: [
      {
        name: 'React Native',
        license: 'MIT',
        attribution: 'Meta Platforms, Inc.',
        url: 'https://github.com/facebook/react-native',
      },
      {
        name: 'React',
        license: 'MIT',
        attribution: 'Meta Platforms, Inc.',
        url: 'https://github.com/facebook/react',
      },
      {
        name: 'Expo',
        license: 'MIT',
        attribution: '650 Industries, Inc.',
        url: 'https://github.com/expo/expo',
      },
      {
        name: 'NestJS',
        license: 'MIT',
        attribution: 'Kamil Myśliwiec',
        url: 'https://github.com/nestjs/nest',
      },
      {
        name: 'TypeORM',
        license: 'MIT',
        url: 'https://github.com/typeorm/typeorm',
      },
    ],
  },
  {
    title: 'UI & Navigation',
    packages: [
      {
        name: 'React Navigation',
        license: 'MIT',
        url: 'https://github.com/react-navigation/react-navigation',
      },
      {
        name: 'React Native Paper',
        license: 'MIT',
        url: 'https://github.com/callstack/react-native-paper',
      },
      {
        name: '@expo/vector-icons',
        license: 'MIT',
        url: 'https://github.com/expo/vector-icons',
      },
      {
        name: 'React Native Maps',
        license: 'MIT',
        url: 'https://github.com/react-native-maps/react-native-maps',
      },
    ],
  },
  {
    title: 'Data & Networking',
    packages: [
      {
        name: 'Axios',
        license: 'MIT',
        url: 'https://github.com/axios/axios',
      },
      {
        name: '@tanstack/react-query',
        license: 'MIT',
        url: 'https://github.com/TanStack/query',
      },
      {
        name: 'i18next / react-i18next',
        license: 'MIT',
        url: 'https://github.com/i18next/react-i18next',
      },
    ],
  },
  {
    title: 'Authentication & Payments',
    packages: [
      {
        name: 'react-native-purchases (RevenueCat)',
        license: 'MIT',
        url: 'https://github.com/RevenueCat/react-native-purchases',
      },
      {
        name: '@paddle/paddle-js',
        license: 'Apache-2.0',
        url: 'https://github.com/PaddleHQ/paddle-js',
      },
      {
        name: '@react-native-google-signin/google-signin',
        license: 'MIT',
        url: 'https://github.com/react-native-google-signin/google-signin',
      },
      {
        name: 'Passport.js',
        license: 'MIT',
        url: 'https://github.com/jaredhanson/passport',
      },
    ],
  },
  {
    title: 'Monitoring & Analytics',
    packages: [
      {
        name: '@sentry/react-native',
        license: 'MIT',
        url: 'https://github.com/getsentry/sentry-react-native',
      },
      {
        name: '@sentry/nestjs',
        license: 'MIT',
        url: 'https://github.com/getsentry/sentry-javascript',
      },
    ],
  },
  {
    title: 'Utilities',
    packages: [
      {
        name: 'Luxon',
        license: 'MIT',
        url: 'https://github.com/moment/luxon',
      },
      {
        name: 'sanitize-html',
        license: 'MIT',
        url: 'https://github.com/apostrophecms/sanitize-html',
      },
      {
        name: 'class-validator / class-transformer',
        license: 'MIT',
        url: 'https://github.com/typestack/class-validator',
      },
      {
        name: 'bcrypt',
        license: 'MIT',
        url: 'https://github.com/kelektiv/node.bcrypt.js',
      },
      {
        name: 'QRCode',
        license: 'MIT',
        url: 'https://github.com/soldair/node-qrcode',
      },
    ],
  },
];
