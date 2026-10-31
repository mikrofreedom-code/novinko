// One publisher identity for the homepage, archive and server-rendered articles.
const SITE = 'https://novinko.sk';
const publisher = {
  '@type': 'NewsMediaOrganization',
  '@id': `${SITE}/#redakcia`,
  name: 'Novinko',
  url: `${SITE}/`,
  description: 'Slovenský spravodajský portál: Slovensko, svet, ekonomika, kryptomeny a umelá inteligencia.',
  publishingPrinciples: `${SITE}/impressum.html`,
  correctionsPolicy: `${SITE}/pravo-na-opravu.html`,
  email: 'redakcia@novinko.sk',
  parentOrganization: {
    '@type': 'Organization',
    name: 'Powerlink s. r. o.',
    identifier: '56985843',
  },
  sameAs: ['https://www.tiktok.com/@novinko.sk', 'https://x.com/novinkosk'],
};

function siteIdentityJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [publisher, {
      '@type': 'WebSite',
      '@id': `${SITE}/#web`,
      name: 'Novinko',
      url: `${SITE}/`,
      inLanguage: 'sk-SK',
      publisher: { '@id': publisher['@id'] },
    }],
  }).replace(/</g, '\\u003c');
}

module.exports = { publisher, siteIdentityJsonLd };
