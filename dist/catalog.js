import { ipv4InCidr, ipv6InPrefix } from "./net.js";
// 2.0.0: the ssn reserved range narrowed to exclude areas 900-999 (the IRS ITIN
// space — real identifiers). SafeSeed 0.3 rejects older record contracts and asks
// for regeneration rather than trusting stale catalog metadata.
// 3.0.0: ranges are unchanged; tier names and claims were narrowed so the catalog
// states what reserves/designates a value without claiming coincidence is impossible.
// 4.0.0: practical sales/marketing fields add Ofcom drama phones, constrained
// marketing URLs, obvious opaque IDs, and fixed SHA-256 allowlists derived from
// catalog-constrained inputs. A derivation never turns the digest itself into a
// reserved value; the field record carries that boundary explicitly.
export const CATALOG_VERSION = "4.0.0";
// Tier-appropriate claim language deliberately avoids proof, impossibility, and
// lifetime-policy language on every tier. The catalog describes the constraint it
// can support; it does not infer that a generated string can never coincide with a
// real party or be handled by infrastructure.
const CLAIM_PROTOCOL_RESERVED = "Inside a namespace reserved by a published protocol for documentation or testing. The reservation is the claim; it does not prove that no infrastructure could ever handle the value.";
const CLAIM_AUTHORITY_RESERVED = "Inside a range or invalid pattern the cited issuing authority currently designates for fictitious use or excludes from ordinary issuance. This administrative-policy claim must be revalidated when the catalog changes.";
const CLAIM_DESIGNATED = "Published for processor or sandbox testing and intended for test mode. It passes checksum validation; the test designation, not mathematical impossibility, supports the claim.";
const CLAIM_FAKE = "Structurally synthetic token; not derived from any real record. This field type is not reserved by any standard, so realism is deliberately avoided.";
const CLAIM_HASHED_EMAIL = "SHA-256 digest of a catalog-listed email under an RFC 2606 reserved domain. The input reservation is the assurance source; the digest itself is neither reserved nor visibly distinguishable from a hash of real data. SafeSeed accepts only the published digest allowlist.";
const CLAIM_HASHED_PHONE = "SHA-256 digest of a catalog-listed NANPA fictitious phone number normalized to E.164. The authority policy on the input is the assurance source; the digest itself is neither reserved nor visibly distinguishable from a hash of real data. SafeSeed accepts only the published digest allowlist.";
const CLAIM_MARKETING_URL = "Canonical HTTPS URL on an RFC 2606 reserved host with deliberately obvious TEST_ attribution parameters. The host reservation and exact token pattern support the claim; an arbitrary URL on a reserved host is not accepted.";
const RFC2606_DOMAINS = ["example.com", "example.net", "example.org"];
const RFC2606_TLDS = ["test", "example", "invalid", "localhost"];
const RFC5737_BLOCKS = ["192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24"];
const RFC3849_BLOCKS = ["2001:db8::/32"];
/** Payment-processor / sandbox test PANs (all Luhn-valid by design). */
const CARD_TEST_NUMBERS = [
    "4242424242424242", // Visa (widely used sandbox)
    "4111111111111111", // Visa
    "4000056655665556", // Visa debit
    "5555555555554444", // Mastercard
    "5105105105105100", // Mastercard
    "2223003122003222", // Mastercard (2-series)
    "378282246310005", // American Express
    "371449635398431", // American Express
    "6011111111111117", // Discover
    "3530111333300000", // JCB
];
// Fixed SHA-256 allowlists keep generate() synchronous and, more importantly,
// keep scan/verify narrow: an arbitrary 64-hex digest is candidate real data.
// Email inputs are already lowercase/trimmed. Phone inputs use E.164, matching
// the normalization shape documented for hashed Google Ads identifiers.
const SHA256_EMAIL_VALUES = [
    { source: "user1@example.com", digest: "b36a83701f1c3191e19722d6f90274bc1b5501fe69ebf33313e440fe4b0fe210" },
    { source: "user2@example.com", digest: "2b3b2b9ce842ab8b6a6c614cb1f9604bb8a0d502d1af49c526b72b10894e95b5" },
    { source: "user3@example.com", digest: "898628e28890f937bdf009391def42879c401a4bcf1b5fd24e738d9f5da8cbbb" },
    { source: "user4@example.com", digest: "40d71d3f998c168e7a254e75c0a1020185cfc67ab52790be92502835953fc41d" },
    { source: "user5@example.com", digest: "4d8f4dd97e0c7b6fed6367bed08adc1fe2c7f6d22fc76f46d63c674c10e4d062" },
    { source: "user6@example.com", digest: "b430419a8a3fa1ce5cafd92d89fe3e832b39b1f1cab0f351c1b270b585d5eded" },
    { source: "user7@example.com", digest: "38121022af9b425b5dbf9b56823cf14183bd617022a8bc39a5843c9d7035d039" },
    { source: "user8@example.com", digest: "675657c179a97bde8a8cb572bfe434126b57311f5e9b49171855c5b6d0952dc5" },
    { source: "user9@example.com", digest: "b1e700bec7b4c7c386a589aa095a87af1792fe4b7b95c011e52e6f73327b098e" },
    { source: "user10@example.com", digest: "1cc95683bbb5c48117e33ef95a500d2224f8c0df2e32b608622b51db69956982" },
    { source: "user11@example.com", digest: "69e6267c53626874ae2ad01d9acae62c21ddfc993ae0967df0a69e13ea2747d7" },
    { source: "user12@example.com", digest: "882ecc75a8c8ab735ee5a9223cd6cd5e6bef1eec2a5da7957cb2a8ff7b2ab6cb" },
    { source: "user13@example.com", digest: "f221e7d82b835de7bab094045e7dd90e0451500180497c8c7d4fb5ee19568280" },
    { source: "user14@example.com", digest: "241b6d9462fcc1986123393cd2e75cb4356647f401262691f7fe1f639415bca8" },
    { source: "user15@example.com", digest: "19e2f1dbc9e6c95e44b1ac158fc7da85ef17b7a10712408949cbb76c0327f768" },
    { source: "user16@example.com", digest: "67df3e41329159dd30a10d56995bd963cdf45bef4432d1cdddd034a61d6bf53f" },
    { source: "user17@example.com", digest: "93aa53ab9b59fb4220dc680e56f570703af13be19feff3c257436158db775050" },
    { source: "user18@example.com", digest: "488500947eaecc9083606cb4cd6b8b2dbce09e3b513c069aa55ce11026bf88e5" },
    { source: "user19@example.com", digest: "66539894c8b69c8b65d6eb5eae0dcdecfc811c8ec3d4d3ab1bb135d9a8b778ad" },
    { source: "user20@example.com", digest: "874c06ecc187c90d2fbdc21ef3b70c202e378e380cee50ad564ec11351f66341" },
    { source: "user21@example.com", digest: "7f76695c184a7084f522c097b2cfa304224a1be5fd07a517097532899a00d1e7" },
    { source: "user22@example.com", digest: "686376fa04fb444aa2dba70805e188a2443dc0d536c1753f5a41f2b6fd21ac57" },
    { source: "user23@example.com", digest: "edd264cc8a18a5c5ecf6b013a0d566c0834fa821459682407a880943d7923553" },
    { source: "user24@example.com", digest: "455e611757446dab1b02b2c4553727ba622bbd922cd1fb2a2cd6dcfa2978f68b" },
    { source: "user25@example.com", digest: "8c25af03c57c291b8dc1ecebab5688d2bc6b38c913102d5542406324e2668bb8" },
    { source: "user26@example.com", digest: "72b2c786c65f1ba907092b7f8066e7a017da40d4dcf3f6199d44de48487420b2" },
    { source: "user27@example.com", digest: "cc491774cd2fdb0b6b9c51c5c7486537ff5001aef68eaed81e740e6d2018b66a" },
    { source: "user28@example.com", digest: "ad4552a28b86fc1eb3721b24c2fef76fa7660949437e0f8bd3713b1b7237bfd9" },
    { source: "user29@example.com", digest: "465b1d6ac7dc2426ecdb8d4088e48df6da123fd1eb308cebf6a5343e7d962c9d" },
    { source: "user30@example.com", digest: "ec0946868db078d04539e484582e614c94bb7e44a565b54efb24c2bdc09ffdab" },
    { source: "user31@example.com", digest: "efd6a580de69c99cd883b63a77cda4e9bd7d79fa66d8b5c775153adceb39dd20" },
    { source: "user32@example.com", digest: "7d2438818506f2057014c918930174ff5387b0f67eab305cf857fac65c7f1bfd" },
    { source: "user33@example.com", digest: "a562ac3d4054b78aa1897e6ce90928f8b377249be294aaa63d6f84d3ff827af7" },
    { source: "user34@example.com", digest: "ba28612cb0c7ca6b13391a1bb7ed21945f0a95c67481bb5bbcc97b58a84b2e45" },
    { source: "user35@example.com", digest: "fbc9d5c359d8c01ac6af7e1c07397432bdd2f2f8570fa9ec603e710e92a5a133" },
    { source: "user36@example.com", digest: "0276ee7a363ce7dbf1f6daf66d22d1d80737cdc27b374c833b46d8618e05e305" },
    { source: "user37@example.com", digest: "70d10a9896d627e766bcbc4fa65ce2326c2168e83c257f49945856a77c5f18dd" },
    { source: "user38@example.com", digest: "c3a3191664df0d5c02f99c3e764eeeaa6b45b66ae80fdcfbebf056846a4c443d" },
    { source: "user39@example.com", digest: "8d9af2fcf6d24b79c9801982f6d541f06023b25c189600479fa84a78d0013863" },
    { source: "user40@example.com", digest: "a6d62fadd3064af68712b05c35bfbce07416ac011013014b4e66e37cadb3c309" },
    { source: "user41@example.com", digest: "33c43b6e6295656b7f3e3eb0deaef8d97809fa20bdd12186d83e32eae998bc69" },
    { source: "user42@example.com", digest: "0b4eed6a0d5eab16ee89d796aeb47fcc0f21394df7f54c8b3baf72467a67da6c" },
    { source: "user43@example.com", digest: "d594f7e25f464bde603a9732a1add02a8ef65fb7081743abfa4e469aa05f49a9" },
    { source: "user44@example.com", digest: "02a6a65b6c88b0dcc0bdd1a7c13493797820f72295ff3463eff6858d3e63e94c" },
    { source: "user45@example.com", digest: "5a9a9d95db29e072ca70ff46c84e9ba83d7adf04655d47ed1e16e40060f459e1" },
    { source: "user46@example.com", digest: "048389ec00f05f7fade4eff690f7a48611d923df70ae5a7ab33087b1b8db3e09" },
    { source: "user47@example.com", digest: "159ea7cd62233088a2496cfa4c4526562b6fc572636386903113bdedb8cca39b" },
    { source: "user48@example.com", digest: "f5cd92ba48393c1c5f4cea57db2776564e45418c753dec5ee8bf3f20236392c9" },
    { source: "user49@example.com", digest: "25ed52f3b8a3b88a725f960c2b1e50927fce5d8822f40d29848e9e784183b339" },
    { source: "user50@example.com", digest: "8e6a08fb163c348aa4751eb7f0d41a213e3f8af8ae2f8a84f6d894bc80d2c1ee" },
    { source: "user51@example.com", digest: "5cdb49c620c03631938369d64f7c111d2c0bd470839c98f220625a5a63dd3e73" },
    { source: "user52@example.com", digest: "bbec1ca58f0e1f7c26954f887e631423e9ef65e5f0bc4cacfab79b1e05fe84f3" },
    { source: "user53@example.com", digest: "7eae2259ba092a52268a26850b3a2465bf87a1ac71afc81b4c7935787ca41500" },
    { source: "user54@example.com", digest: "e967a9c021c54e663bc75600a04b8ae18c028b820c6d55df7acf7b9b25ad924d" },
    { source: "user55@example.com", digest: "741d2c9b7823197280498e651d52da07bfa28ef7d9ed67d2bf7beae95730f3cb" },
    { source: "user56@example.com", digest: "f03dc0a8cb6a3421c366a65aeb3322e02a4fe9c8392a7cbb9faff1fd8201bf4a" },
    { source: "user57@example.com", digest: "7bd08834d8643067d5b23d63600749061ad63ccdec190ca3339441089c24a2f4" },
    { source: "user58@example.com", digest: "61a4cd190cb3efb5c3dfe153954d85482a705e7fb0fbc877bb3898569337cf3f" },
    { source: "user59@example.com", digest: "a99e0722227346b4884e9efab8c9eade7f3c5e4a6172bd4152ac2b6bc6f2b1d2" },
    { source: "user60@example.com", digest: "5753989f234011667a99d9bb296ac243c05999a23e080ef3265083021560b05f" },
    { source: "user61@example.com", digest: "f5de927e823a4087de630c22f3173d0ee037e27ca18caa33f17f4ee4ac053eca" },
    { source: "user62@example.com", digest: "aa84db913fc0c56f86f95b1a51afca27e3a8ad9fdaba9d5b1effc5a22c70bc0d" },
    { source: "user63@example.com", digest: "410b5d5b35c22297d50f0018a54f82ff23a00463cb1f9c9d60bf939422de98c8" },
    { source: "user64@example.com", digest: "308bf0d77b78c1b34301ea55f1b9b1d12364e02917e015adee621343cdb63be1" },
    { source: "user65@example.com", digest: "a957dac968adde8777e385de1c642e18208348c14341637ae8a01591e9794359" },
    { source: "user66@example.com", digest: "15dc0eb13231f3330041c1ab49c7574a70aa4a61f642797f4203409d86a9b2fc" },
    { source: "user67@example.com", digest: "84d249409195073003daac564eabd99f7b5e5e06c68a7e5e7b1c680d09938e0e" },
    { source: "user68@example.com", digest: "5238d4bdb811e96481e4dc825b05916a9e6327e1f7a6f6c96e4f45638ef7df30" },
    { source: "user69@example.com", digest: "5f2c3214d8642f810d1370d5a195bb12721fd9f09989c6150120e0ca84054e08" },
    { source: "user70@example.com", digest: "10e978e3e34d972d7965cba0b2e846dffb607c950955431d07c19597da5efb93" },
    { source: "user71@example.com", digest: "3f61fd8edee5f8fb7828d7bd473d78063dfea1900faddaa2eafc7be201b790bc" },
    { source: "user72@example.com", digest: "2c41b9d011bc28e71842637075e2a67cf4e73010172f4a18985494467d73a6d6" },
    { source: "user73@example.com", digest: "00b340221ad566a1400936daadce44a7c61b5b04505fc66d3d55d96bde434bc1" },
    { source: "user74@example.com", digest: "5f5042662f0888477f61f4e44eff10dfb50ca3a4034046fac783e788b47c09eb" },
    { source: "user75@example.com", digest: "b881e2ca1096be8514ee6a61d2c8053e196ffe97803bf4ac912a4b8994091b63" },
    { source: "user76@example.com", digest: "1dca3865f17c2ca97fefc8f62fcd740e06bd913bc4adcbf22df765e3980f718f" },
    { source: "user77@example.com", digest: "9f65e294850dc82df7e6a04714bb563c22818eb135d9f2033540e39e6c0e8349" },
    { source: "user78@example.com", digest: "23774e98ed75f4207193f344055ba752d25b92a7ddaf1670a058a66ca3af06ea" },
    { source: "user79@example.com", digest: "079fabe3cfbd5d5d57c38791ac604ae02aad7c5bed97d5aca6561e8f017a9e82" },
    { source: "user80@example.com", digest: "cdbe7cccc0d4d8bb60414a0cc4303b82f2ced7de9ad389b01c45d62c8b9f866d" },
    { source: "user81@example.com", digest: "6d60151c48bcb3b05160620d4d9fdf6d2c3d3e32886ef3182a0cbe7c104d536c" },
    { source: "user82@example.com", digest: "ea054040330b6ad182df6f22764f00f081886187f9f8662a71d1160361fdfba9" },
    { source: "user83@example.com", digest: "1c647d004c91e3a20e3bae79b51ed1b90d0d1fdca12b1fe3b420695fa9edd4ea" },
    { source: "user84@example.com", digest: "af87a19f51f28ed9f9ff2fe50d05bae7b0fd7e27be422c5be7184853db62e079" },
    { source: "user85@example.com", digest: "1c3c150b60c18ebda6d93d5ab24785b8eefc2698a9d211d7f9800672ffa2916e" },
    { source: "user86@example.com", digest: "9104b561ee63b7cb60084fad4269912d7f4d480974ff478d0617712525188566" },
    { source: "user87@example.com", digest: "9d175b92f1fe6261e74542a1530c2603bd312e7c820164ad59cc72537d4cad44" },
    { source: "user88@example.com", digest: "db597abc24a6facfd24ebc78da09608969aaf98ccdeef776c9312c51ce8b437b" },
    { source: "user89@example.com", digest: "45515fd8302b52215f8ceef996c5660529bfe27d5955f27e6608ef4504f77445" },
    { source: "user90@example.com", digest: "b6e523c79f780659f2bdd2b1c137b8e40877597b788c77015d8c0756ebfde165" },
    { source: "user91@example.com", digest: "f2b1a3326836af85f203c4ebf70004a59eb5f6ad6ee75a15cf08a2c12c6b129c" },
    { source: "user92@example.com", digest: "dbf0c61b90e105298668a0d05a4a47f13cc6ffa8c99f70895629ee617064d68a" },
    { source: "user93@example.com", digest: "48faedeed8aa98c5c360f54cc64bb7ca72a891eaa75ed813ca1c4544d7b1057c" },
    { source: "user94@example.com", digest: "fce79aed97fc560e4c0b2e044477e3ee9cdd1fabf8f726d18bc1f7b5a4f8f0c5" },
    { source: "user95@example.com", digest: "dbe180d9c3ae5f03756061c897e6c6018848eca9ae9da507c9e8cd0fe53590de" },
    { source: "user96@example.com", digest: "4b36fcecc8960ce05dca75c24937e2a1b25e0ce3e062181c9bf8d94e31719b5c" },
    { source: "user97@example.com", digest: "52c0c448d7ff2be77bc8d091c5d0672fa8e89921cf16bf7cb5ce82e662293a9b" },
    { source: "user98@example.com", digest: "8318650a76c3e4157b1fd59639583384ccdc2f3b2e7b4fb9ac984692b6596caa" },
    { source: "user99@example.com", digest: "5ac244099108429db98c3753530059f6388fef6a23be95fd8a1fc202ddcd2338" },
    { source: "user100@example.com", digest: "4e69c54e97cf06ccde17c8ff09e31acf56a3c12051fd0b1acb803531f2f72339" },
];
const SHA256_PHONE_VALUES = [
    { source: "+12025550100", digest: "56bcf01f15ebc008e3e50bad3555d6cfafa76c6472eb64c8d4b24f06f3c995d8" },
    { source: "+12025550101", digest: "0ad2aee0d8bcfaa7761e180c8e143c29cb9196db238100a988ba7ab25c6eb049" },
    { source: "+12025550102", digest: "ea9e17deffc39355cbaef225d4e5675ce3a624c74294119c1a6a8173fc446e6e" },
    { source: "+12025550103", digest: "595cced60f3619228a31bedf43d8d542094198ce4b24a1571d5f0ae7b0754efe" },
    { source: "+12025550104", digest: "c6ae0a7589bdae11249ffe3492364cee39b174712709db435c89ece513f3ec9b" },
    { source: "+12025550105", digest: "78495db431a164e459def438ed14a95ffa6ec47948ed21cad237924f1ec4b79b" },
    { source: "+12025550106", digest: "d104474516dc90ad93f54ffc20214fceb0fc24423959a0e96df03b2411d90d48" },
    { source: "+12025550107", digest: "f59451375cde05864ce200a9f9999cd466cece88e953d0782adcba0c05f794af" },
    { source: "+12025550108", digest: "1cde78a29dde256828b905b5bdd3da196811fe0228c183fc43f75b9c37bffd93" },
    { source: "+12025550109", digest: "bbb4a3a22560a2e3da7a701891f6a391c2561355c64c5dd0da72c4b802e0e910" },
    { source: "+12025550110", digest: "02fbdd3704b7ae79a6ce959e6c13f2dcb5f65e5956eed1689fcb449670a1b735" },
    { source: "+12025550111", digest: "461af0e674b1a18c6862f945743ff155f193ba83d18ef86c2b85aa2dbb11595a" },
    { source: "+12025550112", digest: "f5ef84481624fae768968ef2bd0b8a0cdef793c31bc913b6e1e52f002108db83" },
    { source: "+12025550113", digest: "d1088a1932349e7d115a790bcd1b1e7ed684fb5d08248928e6dbd96eb42ce469" },
    { source: "+12025550114", digest: "cff271d5e2ed995d90ba865695fe86ddba9124103494f624acf0744fa8edc1a6" },
    { source: "+12025550115", digest: "717616a2c1550ad0516675d32d97e76e039a1a8a2f577dad9646f127c3f52e67" },
    { source: "+12025550116", digest: "014df11af60c85a1a1261457dbe1dbf03ef85d82e34768f3d0191b7e9723f018" },
    { source: "+12025550117", digest: "2439e372095c99db6f778ab8f68210f814b55767a88b48612073ec02f98d35e9" },
    { source: "+12025550118", digest: "3c44b1d22eb757809c0be3cbf0b7929cadb1578b023f925b50a5dfcf4c885752" },
    { source: "+12025550119", digest: "2a4c9f1ebfbdda8f39e1c4bb7209faac14be1791f0b87db5276d6725e1e35771" },
    { source: "+12025550120", digest: "1a206e31e4c02e13713cff47b7eb87b435288f837d177128867ac3cf4002c77e" },
    { source: "+12025550121", digest: "057d5774413ad844aa7d2abf44294126964321a64f9a7fd9d2f9b5ef30155b7e" },
    { source: "+12025550122", digest: "d69ef8f130991b8ba2b08234e9e5e71c4b71553248249470e31bd3dd228ef526" },
    { source: "+12025550123", digest: "d5ab8b77e69a81dfc634c3556c620d5d6753df6fc28c73c88c79a9332b705382" },
    { source: "+12025550124", digest: "1a2d415d4fef1dfafe57e0d98af15bbad8cc4bd8ca8ac66e89f2e0ef3941d500" },
    { source: "+12025550125", digest: "a35d67cfeee32bd05180b8505fc2dadd3006d0b759c312ce50aa3a166406e09b" },
    { source: "+12025550126", digest: "794df82e0eed9c510cbcb55f247b95daf096d0e5bafd63ef4b792b2f2e15680e" },
    { source: "+12025550127", digest: "cabc11b1389a39a78b4dc3bb54611c161b83dc5917ebfce3051033de769f4256" },
    { source: "+12025550128", digest: "43debc33e69981d9c55e154a3551549f0b0790d353350de67a656a95fc3d4905" },
    { source: "+12025550129", digest: "952e06a62302c0f8a4a19a923b3342193c34789878fd17261571a1ce7596336c" },
    { source: "+12025550130", digest: "50965082332d77618fc0bd2536677fd99be9f633e35b66d2b76d7d8cab12e9c3" },
    { source: "+12025550131", digest: "f83fe9be9638cc327dc0665c83a62c70ae45219800746db89c0048fef743ba93" },
    { source: "+12025550132", digest: "38ac8870a303ebacf84418e175661e73db775724ed6d37cbaea7a197dfd5080a" },
    { source: "+12025550133", digest: "c732834faf138b0fd29a80d2a836c0a082dc3276df2bd3a4cb777ccd789fbd7a" },
    { source: "+12025550134", digest: "dca706a2b68780b885d24490462c977d4856af12c105d7f46ca48ece76cda0c7" },
    { source: "+12025550135", digest: "3363befbe5ce77901173e4ddb55160ff3f9d5d738fbb5a8afea3ada367c9ac2c" },
    { source: "+12025550136", digest: "f1c05fede0e38923700af86d85aa7a780c5d457857a9851b361773af6d5ba3dc" },
    { source: "+12025550137", digest: "a32507ffa4b2019d81282881a12e315c36d88cd350f261346cd5f0f91175cc2f" },
    { source: "+12025550138", digest: "889d80dcbd4566a70e32a3a7b5bec101f97805d079db117e43653915d1b24f67" },
    { source: "+12025550139", digest: "f1ee424497f5fd924523393eda8eeee76ae6c2e24485735c7c54b1acfa82bbd8" },
    { source: "+12025550140", digest: "974c506f86cb8c1fe3acf2d708d0c0dcdd3b6c39fb422b3ed300523190e69d66" },
    { source: "+12025550141", digest: "102ca36e833561e4036aed7e730eda4075197ec3f89f1de953d8aad158eb38f9" },
    { source: "+12025550142", digest: "409483139e442a5779f262ef73d3872fde883e902c78497cd9eb874cd308651b" },
    { source: "+12025550143", digest: "54af34308301e43f00650baaeb6cf4925b942201d74191b26d48292cfec907fd" },
    { source: "+12025550144", digest: "234592ff3d95e72b9b84fa268189e0ffe35f18c2debc2ac92c05694b74aa2d60" },
    { source: "+12025550145", digest: "a2addf1d05e79c958cd6c8a52157dfab2d7259e0176a06f5eb34ada689a151df" },
    { source: "+12025550146", digest: "ec7e6b85f24fa6b796f1017236463f1b7160fbdc5e663e39ab363b6d6fe30b9f" },
    { source: "+12025550147", digest: "1878fb3455605ca58929453d453a56491a81edcdb262de8bab6d4f3d15d33cb9" },
    { source: "+12025550148", digest: "f811d4fbf2087459f86694edbe67b9b2c6d70e7a1dfdf7835f695108344b5158" },
    { source: "+12025550149", digest: "6e236530cfb5d3a87ab5adf1dd101fca190f9bf7f80f012dfcf260c35f45bef0" },
    { source: "+12025550150", digest: "759ee3ac52e6a51a574d4178c0760e206b7e9f14f42ed97b7b10fb94c52f1edc" },
    { source: "+12025550151", digest: "87b08391435df66e5c2e7f50ea962bc2d9f55f04c03f81416b20e5f987b3d6e4" },
    { source: "+12025550152", digest: "05970f4d2eff89f7a8485f817eedd10b1f95cc8571be2e617811567d4ae6700f" },
    { source: "+12025550153", digest: "0e36599dbe4a30d6c4ca49bf44f52e687c3cf70864ef94641d531f6ba534edf3" },
    { source: "+12025550154", digest: "e5f37e9438bce87698f0d5394f46297b85976875b7c3fd2980ace45dd2e54d5b" },
    { source: "+12025550155", digest: "3099135dbc16bacb77d31739df6c1b45dbf9407d894ff16075f0b06bc5a9a4b9" },
    { source: "+12025550156", digest: "c7ae3ba36fb2e7c440033f828f6bab583d35c5af064c7a81b74fda104ea9aa63" },
    { source: "+12025550157", digest: "ec13762b87b1706817cd9febab8b142525a09b8c7eaf565f5aa74b71a4659540" },
    { source: "+12025550158", digest: "bc6785a2930c7348b32c5df3711e4e6c333c75f6481c323fb0499c823720d09c" },
    { source: "+12025550159", digest: "9c7c416415cb4510f67a1a41cf5e58a2ea0ab862728ea7e1352b98dc8ab9f175" },
    { source: "+12025550160", digest: "f501af6e2fefbead4bf3128098d43eef92b23f1c235e1c75d61adda551aa8772" },
    { source: "+12025550161", digest: "4ac2150a305667d01beec0709f76e76708d941402b174ef4de9188341ca1c12f" },
    { source: "+12025550162", digest: "01c952c454f7c744b1adacd5ec8af7500237a1189eb779b9bbd9a602b91d53de" },
    { source: "+12025550163", digest: "8947762c3d05c429e5070f75cd95d64d2b330b810ba8c11b38b1f3ce2931b26f" },
    { source: "+12025550164", digest: "24758b27abab43e6a24759289d58fa30031bfb3b873b0a7b928e9675c5c3cf20" },
    { source: "+12025550165", digest: "afe9774baed680938fb68dbb4542fa1b424e53e186d2ff44cc0abbc2e565ed3d" },
    { source: "+12025550166", digest: "284f762c65dae4fa4cc215e05d07cb78b52c9b34833f71a1ed12f96dc6fd09ef" },
    { source: "+12025550167", digest: "47e6fb75c4d3201a3296c54978745d3581d9c45d32617505fcd08e1d619e56ba" },
    { source: "+12025550168", digest: "25f99be8fc06c52d3c8cb0a566d58333a727b5caaf9b79d23b97845936affe44" },
    { source: "+12025550169", digest: "6e8f5d4c2229787cc8cbcd9d8545a389e0142b094bf36eff1e507549ae49557f" },
    { source: "+12025550170", digest: "b384bd12c4d971cc5ef41bad1eb3b2c28fb7595e3865d6cd18b943a2cc84742a" },
    { source: "+12025550171", digest: "d558d7e636bdfd97d2df66c88e699bf2a51c4fcdf68ffcb5f9a50b1da99db7b5" },
    { source: "+12025550172", digest: "aae63041cfb09c76879658178c242fa70bd4a14a5c54412ca61b7bab542131ab" },
    { source: "+12025550173", digest: "c3060480bc7601985026fd9bb24c0c7310a73c673f1eef157d9a83507af8407f" },
    { source: "+12025550174", digest: "ad7b46e4c55934fc6517e631f142a7df106d07efde224877b12d8ded01fc1d68" },
    { source: "+12025550175", digest: "084ade127b52d26ee48687d665723e5f6711cab28a116da486d78b24de29aac5" },
    { source: "+12025550176", digest: "a51af1d754b25487804cff90813433242bfb4a9f351b600cbce0a1cc16a860a1" },
    { source: "+12025550177", digest: "f94135cccdee96e4193defb831b5b88c22830d0c1d81e65a5895e15ebba61f4c" },
    { source: "+12025550178", digest: "6608b873956969a8b3e01c83f0a42d7fc7b439cbeea3919cd8f931b19ab160da" },
    { source: "+12025550179", digest: "19b1956ac0071e732c92cd5312478cf30dd5069d8c724927fac40c7ecada3546" },
    { source: "+12025550180", digest: "b82370ec833a7f1abb73d72cd8be968383102db7a2ebd5ad3daf9af3e83b7e84" },
    { source: "+12025550181", digest: "15e90842f71ab7e57939b8d27b899e322e85a9d12df8b76258ff50d604feae6a" },
    { source: "+12025550182", digest: "91ea7f4164e34e0759d20c3a929c3078dfdc362cb69d18838260463f511a96bb" },
    { source: "+12025550183", digest: "dba824afd1828d2eac3782ae9af825bdbc1ed82e0ac290d0da3b2a2a42b2b5b1" },
    { source: "+12025550184", digest: "235aa2067af86093e8f94a4bd339c6fda3cb5d6c37e88e531d343e9b929890e8" },
    { source: "+12025550185", digest: "2e9e928a459e285b6ea0fedda2434f583a812556e7cb8af41a384e6b711f9ef8" },
    { source: "+12025550186", digest: "acbc8e7522f88482196779a4497c7ca39c052bc6a860fa156e19eae8bbcd1b11" },
    { source: "+12025550187", digest: "9764e62009a27f391b0f3dce457effe244f28a8f89ce1b219298cb518af40a33" },
    { source: "+12025550188", digest: "8881642ee0dffa08def1dc0781fcd187a39f37a55a14a1376d869541fa31a9f9" },
    { source: "+12025550189", digest: "70393bc238f2d0be8cde5d67985e6fa8e802faf419cfc3507764ee52258c8df5" },
    { source: "+12025550190", digest: "a975c8a177fbec66f5da22327e94a353f2d43be2cfa742bab82726b05cfafa28" },
    { source: "+12025550191", digest: "445023654f7310ec6972540b139b0da8855e5629035bf2884c10471d1a74b474" },
    { source: "+12025550192", digest: "9634a05c2fe2ab26e7251f4c69652c20036e54d2ade7faf2a03349500b77064b" },
    { source: "+12025550193", digest: "b667f75f0eac5e46d5eb71f85ef713829a5e3a84b45f41ace62d3144ed2dd213" },
    { source: "+12025550194", digest: "d04c1fcd8eab4159d899dc74bb018e6207c126c7173b27c095564d8a2bde50d9" },
    { source: "+12025550195", digest: "3a75c91113bf07ad66685e77ddcf909f087d11222925265b3279f23a8050576e" },
    { source: "+12025550196", digest: "e6a4fa7ca012414e75112fff55c86d649ab49ca383b4030ec807a40b0c22b633" },
    { source: "+12025550197", digest: "c28c37a19b095007c30ee3f664c633cf5dc255a5c6ee8f026c394fe2f52da8fa" },
    { source: "+12025550198", digest: "0b764ff05f25759b8ab040872abaf0084f465951b34f02ce98dc028f847c1cfd" },
    { source: "+12025550199", digest: "8843a82fa982b6fa813c4782aeebcf17009c2619e71410b20d9dae421ed77ddc" },
];
export const CATALOG = [
    {
        field: "email",
        tier: "protocol-reserved",
        citation: "RFC 2606 §2–3 (reserved example.com/.net/.org and TLDs .test/.example/.invalid/.localhost)",
        description: "Email-shaped values under an RFC 2606 reserved example domain or TLD; reserved for documentation and testing rather than customer production use.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "emailDomains", domains: RFC2606_DOMAINS, reservedTlds: RFC2606_TLDS },
    },
    {
        field: "sha256Email",
        tier: "protocol-reserved",
        citation: "RFC 2606 reserved example.com inputs; SHA-256 hex normalization per Google Ads enhanced-conversions documentation (support.google.com/google-ads/answer/13262500)",
        description: "Lowercase SHA-256 digests from a fixed, published allowlist of email inputs under the RFC 2606 reserved example.com domain.",
        claim: CLAIM_HASHED_EMAIL,
        derivation: "SHA-256 hex of a lowercase, trimmed RFC 2606-reserved email input from the published catalog allowlist.",
        reserved: { kind: "sha256Allowlist", inputType: "email", values: SHA256_EMAIL_VALUES },
    },
    {
        field: "domain",
        tier: "protocol-reserved",
        citation: "RFC 2606 §2–3 (reserved domains and TLDs)",
        description: "Hostnames under an RFC 2606 reserved domain or TLD.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "domains", domains: RFC2606_DOMAINS, reservedTlds: RFC2606_TLDS },
    },
    {
        field: "ipv4",
        tier: "protocol-reserved",
        citation: "RFC 5737 (IPv4 documentation blocks TEST-NET-1/2/3)",
        description: "IPv4 addresses inside the three RFC 5737 documentation ranges, which per the RFC should not be routed on the public Internet.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "ipv4Blocks", cidrs: RFC5737_BLOCKS },
    },
    {
        field: "ipv6",
        tier: "protocol-reserved",
        citation: "RFC 3849 (IPv6 documentation prefix 2001:db8::/32)",
        description: "IPv6 addresses inside the RFC 3849 documentation prefix.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "ipv6Blocks", cidrs: RFC3849_BLOCKS },
    },
    {
        field: "phone",
        tier: "authority-reserved",
        citation: "NANPA / ATIS fictitious-number assignment (555-0100 through 555-0199)",
        description: "North American numbers in the 555-01xx subscriber block the numbering authority designates for fictitious, non-working use (administrative policy, not a protocol limit).",
        claim: CLAIM_AUTHORITY_RESERVED,
        reserved: { kind: "phoneBlock", centralOfficeCode: "555", subscriberStart: 100, subscriberEnd: 199 },
    },
    {
        field: "ukPhone",
        tier: "authority-reserved",
        citation: "Ofcom, Telephone numbers for use in TV and radio drama programmes: mobile 07700 900000 through 07700 900999 (ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama)",
        description: "UK mobile-shaped numbers in the Ofcom drama block, rendered nationally or in E.164 form.",
        claim: CLAIM_AUTHORITY_RESERVED,
        reserved: {
            kind: "ukDramaPhoneBlock",
            nationalPrefix: "07700900",
            subscriberStart: 0,
            subscriberEnd: 999,
        },
    },
    {
        field: "sha256Phone",
        tier: "authority-reserved",
        citation: "NANPA / ATIS fictitious 555-0100 through 555-0199 inputs; E.164 normalization and SHA-256 hex per Google Ads enhanced-conversions documentation (support.google.com/google-ads/answer/13262500)",
        description: "Lowercase SHA-256 digests from a fixed, published allowlist of E.164 NANPA fictitious phone inputs.",
        claim: CLAIM_HASHED_PHONE,
        derivation: "SHA-256 hex of an E.164 NANPA fictitious-number input from the published catalog allowlist.",
        reserved: { kind: "sha256Allowlist", inputType: "phone", values: SHA256_PHONE_VALUES },
    },
    {
        field: "ssn",
        tier: "authority-reserved",
        citation: "SSA SSN randomization (effective 2011-06-25): never-assigned area 000 / 666, group 00, serial 0000 (ssa.gov/employer/randomization.html). Areas 900-999 are deliberately excluded: that is the IRS ITIN space (9XX-XX-XXXX), which contains real, issued identifiers.",
        description: "US SSN-shaped values containing a component the SSA identifies as invalid for SSNs: area 000 or 666, group 00, or serial 0000. Areas 900-999 are excluded because they overlap the real IRS ITIN space. A validator that encodes SSA issuance rules should reject these values.",
        claim: CLAIM_AUTHORITY_RESERVED,
        reserved: {
            kind: "ssnInvalid",
            invalidAreas: ["000", "666"],
            invalidGroup: "00",
            invalidSerial: "0000",
        },
    },
    {
        field: "creditCard",
        tier: "designated-test-only",
        citation: "Payment-processor / sandbox test PANs (e.g. Stripe testing docs); intended for test mode",
        description: "Card numbers processors and sandboxes publish for testing. They pass the Luhn checksum; their test designation is the assurance source, not mathematical impossibility.",
        claim: CLAIM_DESIGNATED,
        reserved: { kind: "cardTestNumbers", numbers: CARD_TEST_NUMBERS },
    },
    {
        field: "marketingUrl",
        tier: "structurally-fake",
        citation: "RFC 2606 reserved example.com domain plus SafeSeed's exact TEST_ UTM token convention",
        description: "HTTPS landing-page URLs on campaign.example.com with three canonical, visibly fake UTM parameters.",
        claim: CLAIM_MARKETING_URL,
        reserved: {
            kind: "marketingUrl",
            baseUrl: "https://campaign.example.com/landing",
            params: [
                { name: "utm_source", tokenPrefix: "SOURCE" },
                { name: "utm_medium", tokenPrefix: "MEDIUM" },
                { name: "utm_campaign", tokenPrefix: "CAMPAIGN" },
            ],
        },
    },
    {
        field: "opaqueId",
        tier: "structurally-fake",
        citation: "No standard reserves CRM, campaign, click, cookie, account, or other business identifiers; SafeSeed TEST_ token convention",
        description: "Cookie-safe, application-friendly opaque identifiers whose TEST_ prefix and normalized column name remain visible.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_[A-Z0-9]+(?:_[A-Z0-9]+)*_\\d{6,}$" },
    },
    {
        field: "firstName",
        tier: "structurally-fake",
        citation: "No standard reserves names; structurally-fake token convention",
        description: "Given names rendered as obvious TEST_ tokens rather than plausible names.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Firstname_\\d{6,}$" },
    },
    {
        field: "lastName",
        tier: "structurally-fake",
        citation: "No standard reserves names; structurally-fake token convention",
        description: "Family names rendered as obvious TEST_ tokens.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Lastname_\\d{6,}$" },
    },
    {
        field: "fullName",
        tier: "structurally-fake",
        citation: "No standard reserves names; structurally-fake token convention",
        description: "Full names rendered as obvious TEST_ tokens.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Person_\\d{6,}$" },
    },
    {
        field: "streetAddress",
        tier: "structurally-fake",
        citation: "No standard reserves addresses; structurally-fake 'Example' convention",
        description: "Street addresses built on the obvious 'Example' street name.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^\\d+ Example (Way|St|Ave|Rd|Blvd)$" },
    },
    {
        field: "freeText",
        tier: "structurally-fake",
        citation: "No standard reserves free text; structurally-fake token convention",
        description: "Free-text fields rendered as obvious TEST_ tokens.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Text_\\d{6,}$" },
    },
];
const BY_FIELD = new Map(CATALOG.map((e) => [e.field, e]));
/** Look up the catalog entry for a field type. Throws if the field is unknown. */
export function getEntry(field) {
    const entry = BY_FIELD.get(field);
    if (entry === undefined)
        throw new Error(`No catalog entry for field type: ${field}`);
    return entry;
}
function domainIsReserved(domain, domains, tlds) {
    const d = domain.toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(d) || d.startsWith(".") || d.endsWith(".") || d.includes("..")) {
        return false;
    }
    // RFC 2606 reserves the whole zone of a reserved second-level domain, so a
    // subdomain (mail.example.com) is reserved too — not just the bare domain.
    if (domains.some((rd) => d === rd || d.endsWith(`.${rd}`)))
        return true;
    return tlds.some((t) => d === t || d.endsWith(`.${t}`));
}
/**
 * Is `value` inside the reserved range declared for `entry`? This is the single
 * predicate behind both `verify` (is generated output still in range?) and `scan`
 * (does existing data contain anything *out* of range, i.e. candidate real PII?).
 */
export function isReserved(entry, value) {
    const r = entry.reserved;
    switch (r.kind) {
        case "emailDomains": {
            // This catalog supports one simple mailbox-shaped value per cell. Reject
            // whitespace, controls, and multiple addresses instead of extracting a safe
            // suffix from a composite value that may also contain real PII.
            if (!/^[^\s@]+@[^\s@]+$/.test(value))
                return false;
            const parts = value.split("@");
            if (parts.length !== 2 || parts[0] === "" || parts[1] === "")
                return false;
            const domain = parts[1];
            return domain !== undefined && domainIsReserved(domain, r.domains, r.reservedTlds);
        }
        case "domains":
            return domainIsReserved(value, r.domains, r.reservedTlds);
        case "ipv4Blocks":
            return r.cidrs.some((c) => ipv4InCidr(value, c));
        case "ipv6Blocks":
            if (value.trim() !== value || value.includes("%"))
                return false;
            return r.cidrs.some((c) => ipv6InPrefix(value, c));
        case "phoneBlock": {
            // Supported shapes are the generated 7-digit form and a 10-digit NANPA
            // number, with ordinary phone punctuation only. Never strip arbitrary text
            // and inspect a safe-looking suffix of a composite cell.
            if (!/^[0-9()+. -]+$/.test(value))
                return false;
            const digits = value.replace(/\D/g, "");
            if (digits.length !== 7 && digits.length !== 10)
                return false;
            const last7 = digits.slice(-7);
            const nxx = last7.slice(0, 3);
            const line = Number(last7.slice(3));
            return nxx === r.centralOfficeCode && line >= r.subscriberStart && line <= r.subscriberEnd;
        }
        case "ssnInvalid": {
            // The value contains a component the SSA identifies as invalid for SSNs.
            // Deliberately excluded: areas 900-999, which overlap the real ITIN space;
            // catalog 2.0.0 removed them.
            if (!/^(?:\d{9}|\d{3}-\d{2}-\d{4})$/.test(value))
                return false;
            const digits = value.replaceAll("-", "");
            const area = digits.slice(0, 3);
            const group = digits.slice(3, 5);
            const serial = digits.slice(5);
            // The entire 9xx area is excluded even when another component is invalid:
            // it is the IRS ITIN namespace, and a real identifier must never become
            // "reserved" merely because its group/serial resembles an SSA-invalid SSN.
            if (Number(area) >= 900)
                return false;
            return r.invalidAreas.includes(area) || group === r.invalidGroup || serial === r.invalidSerial;
        }
        case "cardTestNumbers": {
            if (!/^[0-9 -]+$/.test(value))
                return false;
            const digits = value.replace(/[ -]/g, "");
            return r.numbers.some((n) => n.replace(/[ -]/g, "") === digits);
        }
        case "ukDramaPhoneBlock": {
            if (!/^\+?[0-9(). -]+$/.test(value))
                return false;
            const digits = value.replace(/\D/g, "");
            let national = digits;
            if (digits.length === 12 && digits.startsWith("44")) {
                // An international E.164 rendering must carry its leading +. Without it,
                // this is neither the generated E.164 shape nor an ordinary national form.
                if (!value.startsWith("+44"))
                    return false;
                national = `0${digits.slice(2)}`;
            }
            if (national.length !== 11 || !national.startsWith(r.nationalPrefix))
                return false;
            const subscriber = Number(national.slice(r.nationalPrefix.length));
            return subscriber >= r.subscriberStart && subscriber <= r.subscriberEnd;
        }
        case "sha256Allowlist":
            return r.values.some((candidate) => candidate.digest === value);
        case "marketingUrl": {
            let parsed;
            try {
                parsed = new URL(value);
            }
            catch {
                return false;
            }
            if (`${parsed.origin}${parsed.pathname}` !== r.baseUrl || parsed.username || parsed.password || parsed.hash) {
                return false;
            }
            if (parsed.toString() !== value)
                return false;
            const params = [...parsed.searchParams.entries()];
            if (params.length !== r.params.length)
                return false;
            const tokensMatch = params.every(([name, token], index) => {
                const expected = r.params[index];
                return expected !== undefined && name === expected.name &&
                    new RegExp(`^TEST_${expected.tokenPrefix}_\\d{6,}$`).test(token);
            });
            if (!tokensMatch)
                return false;
            // Reconstruct the one canonical representation. This rejects semantically
            // equivalent percent-encoding and other spellings that generate() never emits.
            return value === `${r.baseUrl}?${params.map(([name, token]) => `${name}=${token}`).join("&")}`;
        }
        case "fakeToken":
            return new RegExp(r.pattern).test(value);
    }
}
/**
 * Heuristic used to assert the structurally-fake tier really is self-evident:
 * a human glancing at the value should see "test data", not a plausible person.
 */
export function isSelfEvidentlyFake(value) {
    return /test[_\s]/i.test(value) || /\bexample\b/i.test(value);
}
//# sourceMappingURL=catalog.js.map