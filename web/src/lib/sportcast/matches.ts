export type MatchBadge =
  | { type: "live" }
  | { type: "scheduled"; label: string }
  | { type: "trending" }
  | { type: "replay" };

export type SportcastMatch = {
  id: string;
  league: string;
  venue: string;
  sport: string;
  sportSlug: string;
  poster: string;
  badge: MatchBadge;
  subtitle?: string;
};

export const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBwQ1b33Tg2FBsjSFsMtZFNeCLeGnOt-cb5jgK4gvgOAD_dfx2ItzrjbUjqCFsZaYXot8bET-czNBzPFcn4oYq1Uzyi9FKrNrUQvwwODZ-W38f6Ucgw63AfjVzoJtwPdKieoaXUixsV-a1hWeNy_v61oLsKlPd4kzvRnLH-yxs3LcDAvlQgvZx7V6XlLrXMeVtABuMv3tDtlorH5pNsfHkMe2Ux_8K5vyq5vFJTd8zbpcw9lHNEEy_xKvL7I4lKCbN_m4lqVJFTwcHo";

export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&q=80";

export const MATCHES: SportcastMatch[] = [
  {
    id: "match-1",
    league: "Teqball World Series",
    venue: "Budapest",
    sport: "Teqball",
    sportSlug: "teqball",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBnUwTm1KreFAKYwt6xd5Yfbt-Z7rh-meOlO-Yf1oblKtlgSNvCD1VrcSLYItHrt1JzXxXOO-e-eMN-grmEm4aB3RTwkdr63bcOWINcXQUVvuGXIL1Z7a_3jPV3VLCIYo8204njGiDQDdm_8yi-JK5HhsiEbFVoQ472aEdFbzcNuL5xNIjgdrV4iXH6Scz1uW9DwioFGn4vkdUuV1jF22ZAIUZW7eXDfDwQ19yTLra4kFjnESzQeaNIukQesW0tWULWstenXunmDvdm",
    badge: { type: "live" },
  },
  {
    id: "match-2",
    league: "National Dodgeball League",
    venue: "Las Vegas",
    sport: "Dodgeball",
    sportSlug: "dodgeball",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAXnpvJzw5PcV4oRXA1a46VhfI65KMpKS2ZaMe22-_2vLwkL8wSrkBfn26DwPdAyTmd1U8KNMKHLIMfGwXEzSiHpxbkejUrrJK2UPCwF3fis1UbMdVKCeYyI1UGcY7qAw4oB27I_s000q-ZcqGNT4-8h2Aq9vPP9ci7uaNc-sDA7XKJNokSmbx-DptMPdwkW50D-9W3ScfjRgxqdw8hVQC6kOWTaRnk9Vbe6IkU8vOVdvhyWaVNg0def1ITyWPnyeX7h2OLOlfq1-Wf",
    badge: { type: "scheduled", label: "Today, 21:00" },
    subtitle: "Today, 21:00",
  },
  {
    id: "match-3",
    league: "World Padel Tour",
    venue: "Madrid Arena",
    sport: "Padel",
    sportSlug: "padel",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBxDSm53sy-4RECnS5S3unf2P37ywb9rIMa4xLBhaYwF9JrVMrmtkAjp02rb2dAIhm56RS8QdUspLIVVMVeQD_xiJtAln8GIhVyzGY9IWzBdk5o_ctrmgfDgP0Uw6g8M5vmgxmxFCPQHFYdqR-fIi0e8j9F88cNUPtrl63fFoF-wXiohUpKtP2NJ7rMLSQXie9kcicVs3wsG2S7soEtbCNMbZSTK7MDvVdJynAARHr_VAPE6g3E4aac5QtAvEKaK_UFF6LrpCqg8glt",
    badge: { type: "live" },
  },
  {
    id: "match-4",
    league: "Spikeball Pro Tour",
    venue: "Huntington Beach",
    sport: "Spikeball",
    sportSlug: "spikeball",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBp21ZXLx6PDarPLKs3NNGxDE5AnzV9VMzIqMQy5ZJU7x09N5derkJb3Ih4Ma_tAYwF5sy2chuULZ4jlw6HyKxv-kCrI9u3nONZrThAxo_Je2-JX5P8hMftT8DTHTeM8EEFj-OZ4Dncfoqtj-cX44s89GTeLN2PBROabsFEpbetZV5D9irS8gOvGsaxtt2RzQuGqJViTjpGdMBvWbSAyNSgToees-gwOMcYMoAl_UhJsNwiNCFu700P6h2LpRaRMV4w5l4rNZqItNDk",
    badge: { type: "scheduled", label: "Tomorrow, 10:00" },
    subtitle: "Tomorrow, 10:00",
  },
  {
    id: "match-5",
    league: "IFSC Bouldering World Cup",
    venue: "Innsbruck",
    sport: "Bouldering",
    sportSlug: "bouldering",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA5MXOuBpJ7Q39de1TfAucflQST2s8GohUxSKyJ_sT6MvhnBIupcsPsnrLCKxDvBDytrMWnf7SI_Bf8M7vq4pu0VaxWebNWFIXOlkUg7u0s_LeSzautKa_TMR2mLlC1CZblAF6cfSUsoroP2VC4RYdC286E1ESamHHp4lgZ7Mv8C8hpLXwfeGNDHAkgqwEvhg9jADGtkOvWkDGZwnBfSABxzMIfP-mE4ERQdvbXkfMTUhjdZP_jEwdF3_HV_d4lkK5uKxShkNbmUfO3",
    badge: { type: "trending" },
  },
  {
    id: "match-6",
    league: "GKA Kite World Tour",
    venue: "Tarifa",
    sport: "Kitesurfing",
    sportSlug: "kitesurfing",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCC00P0wvRF_MBUWqXrLt5Z1mdygbdSkHdYumsqWP3kShvVgj7bo0GE0cPNEg_6q1L77l6bB9Wl2JPwD9pzgOW2Nwc5WEfzdB5svfpPLzwqg4BgQtYPUn51X2Z2BvT4_Na8-4BI3wFN23qDkeVm7c72f9FuCQrY6Bxbs7KssuHgY_KGmgk_Vpd_0pqpaC2hpnnnYF4qQKkuUELnRavFKRlvbeGFAG0jX1S1SOL7B1NLv5MkoV_u2rEexI2cACEqaJ-wROsxJ7HDHRyp",
    badge: { type: "scheduled", label: "Starts in 4h" },
    subtitle: "Starts in 4h",
  },
  {
    id: "match-7",
    league: "Finnish Hobby Horse Champs",
    venue: "Helsinki",
    sport: "Hobby Horsing",
    sportSlug: "hobby-horsing",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAzIBJkJ0QShuDUD1hBch2nINbZ6LVrKz8KqgE4h6P4VRg09zbG59U49Wn2X8MQk9gXqwp5J_uLu-LhOKHmUoIYZz6WU_YnnNGrCM4k2UW1UQNzVQUiS6Dl9qToc0Pg85qvSn_MYhUZR75txcVgXmKar1ktC2p74f_Fga-nTOWgnr3Vjde4SYOiYEjPUq691VmHDnohM18H3JC-7FWlkYxE5WVAs0lt_ShH8VEKO2qv1Ip1mgzWGZbvpiuz5YOCiZJ1Od5x6wBin6LG",
    badge: { type: "replay" },
  },
  {
    id: "match-8",
    league: "CMAS World Championship",
    venue: "Sheffield",
    sport: "Underwater Hockey",
    sportSlug: "underwater-hockey",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDfYpYaXPM0arN2aT-c02mlUXwsa9HPOh91JNPIEDKgyuaFdQvyNYufq7C7bfXLtWCm0q-3D92NIICEPKs4aWBWoAf2V2qjlSInjRuqHRukqFdMFT21YiR3Utt0pP4JCMqePMk04ZKrImRXf_6XcSqqE5Uph-uefNr5gz7Bo6Yd4zyzcZ_IHAVDYUzVHegZ2Dl03L24IL8bczu2GgHr72xdQiMOJkr2g-F-f6JRCguIF0m39mAt-F23v8vedlLMYR4BE1SRRreHueVV",
    badge: { type: "live" },
  },
  {
    id: "match-9",
    league: "Bassmaster Classic",
    venue: "Lake Guntersville",
    sport: "Fishing",
    sportSlug: "professional-fishing",
    poster:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAlEIOqm-L25WcbAT4FB4WmxSBX6Ava2zPMwbeqoX4kQyCew-SPyq1-i7Z3Sw93pMHPrE1p82niiOZ-wYZ7lPyUH1RVGusiDo38YW9fu1sCk6hbiQwG5RKn7yDQBY8hBM3ezGjm3yu392hJKqf7GLb0Gp0xAme9NAmaHodcUbjD5nZ-trn9gZERhZFv9MZHrCDnRrFBfhp3CjndoiedaWJdJ103v7guiT3eJagw1HqDQr75BPJYvcEtGTn6CVgdZsy8PAEVz30RxCj8",
    badge: { type: "scheduled", label: "Today, 16:00" },
    subtitle: "Today, 16:00",
  },
];

export const SPORTS = [
  { slug: "all", label: "All", icon: null },
  { slug: "teqball", label: "Teqball", icon: "sports_soccer" },
  { slug: "dodgeball", label: "Dodgeball", icon: "sports_handball" },
  { slug: "padel", label: "Padel", icon: "sports_tennis" },
  { slug: "spikeball", label: "Spikeball", icon: "sports_volleyball" },
  { slug: "bouldering", label: "Bouldering", icon: "landscape" },
  { slug: "kitesurfing", label: "Kitesurfing", icon: "air" },
  { slug: "hobby-horsing", label: "Hobby Horsing", icon: "toys" },
  { slug: "underwater-hockey", label: "Underwater Hockey", icon: "scuba_diving" },
  { slug: "pickleball", label: "Pickleball", icon: "sports_baseball" },
  { slug: "professional-fishing", label: "Professional Fishing", icon: "water" },
] as const;

export const ONBOARDING_SPORTS = SPORTS.filter((s) => s.icon).map((s) => ({
  label: s.label,
  icon: s.icon!,
}));

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
];
