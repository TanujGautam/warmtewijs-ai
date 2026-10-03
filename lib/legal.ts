// Terms and privacy texts (Dutch and English). DRAFT — have them reviewed by a lawyer before relying on them.
// They describe what the app actually does; update them whenever data flows change.
import type { Lang } from "./i18n";
import { COMPANY, CONTACT_EMAIL } from "./site";

export interface LegalDoc {
  title: string;
  intro: string;
  sections: { h: string; p: string[] }[];
}

function who(lang: Lang) {
  const ph = (en: string, nl: string) => (lang === "nl" ? `[${nl}]` : `[${en}]`);
  return {
    name: COMPANY.name || ph("company name", "bedrijfsnaam"),
    kvk: COMPANY.kvk || ph("KvK number", "KvK-nummer"),
    address: COMPANY.address || ph("address", "adres"),
    email: CONTACT_EMAIL || ph("contact email", "e-mailadres"),
  };
}

export function terms(lang: Lang): LegalDoc {
  const c = who(lang);
  if (lang === "nl")
    return {
      title: "Algemene voorwaarden",
      intro: `Deze voorwaarden gelden voor het gebruik van Warmtewijs AI (warmtewijs-ai.vercel.app) en voor de aankoop van Warmtewijs Plus. Warmtewijs AI wordt aangeboden door ${c.name}, ingeschreven bij de KvK onder nummer ${c.kvk}, ${c.address}, bereikbaar via ${c.email}.`,
      sections: [
        { h: "1. De dienst", p: [
          "Warmtewijs AI is een online energieadviseur. Op basis van openbare gegevens (zoals de BAG en EP-Online), gegevens die je zelf invoert of uploadt, en een rekenmodel geeft de dienst indicatieve informatie over energiebesparende maatregelen, kosten, besparingen en subsidies.",
          "De antwoorden in de chat worden opgesteld met behulp van kunstmatige intelligentie (AI). Ze kunnen fouten of onvolledigheden bevatten. Bedragen zijn indicatief en gebaseerd op aannames die bij het plan worden getoond.",
        ] },
        { h: "2. Geen financieel of bouwkundig advies", p: [
          "De informatie is algemeen en indicatief. Het is geen financieel advies in de zin van de Wet op het financieel toezicht, geen bouwkundig advies en geen vervanging van een inspectie, energielabel of offerte van een vakman.",
          "Neem beslissingen over leningen, subsidies en verbouwingen pas na eigen controle, bijvoorbeeld bij RVO, je geldverstrekker of een erkend adviseur. Subsidieregels en bedragen kunnen veranderen.",
        ] },
        { h: "3. Gebruik", p: [
          "Je mag de dienst gebruiken voor je eigen woning of in opdracht van de eigenaar of bewoner. Upload alleen documenten waarvoor je toestemming hebt, en geen documenten van anderen zonder hun toestemming.",
          "Het is niet toegestaan de dienst geautomatiseerd uit te lezen, te overbelasten of te misbruiken. Wij kunnen de toegang beperken bij misbruik.",
        ] },
        { h: "4. Warmtewijs Plus", p: [
          "Plus is een eenmalige aankoop van € 19 (inclusief btw) per woning. Plus geeft toegang tot de offertecheck (maximaal 5 offertes), de brief aan de verhuurder, het VvE-voorstel en de offerteaanvraag.",
          "Plus wordt geactiveerd op het apparaat waarmee je betaalt. Met de herstel-link kun je Plus op een ander apparaat gebruiken. Bewaar die link zorgvuldig; iedereen met de link kan je Plus gebruiken.",
          "Plus blijft beschikbaar zolang wij de dienst aanbieden, en in ieder geval twaalf maanden na aankoop.",
        ] },
        { h: "5. Betaling", p: [
          "Betalingen worden verwerkt door Stripe. Wij ontvangen en bewaren geen bank- of kaartgegevens. Je ontvangt een betaalbewijs van Stripe per e-mail.",
        ] },
        { h: "6. Herroepingsrecht en terugbetaling", p: [
          "Plus is digitale inhoud die direct na betaling beschikbaar komt. Bij het afrekenen geef je uitdrukkelijk toestemming voor directe levering en verklaar je dat je daarmee je herroepingsrecht van 14 dagen verliest.",
          "Werkt Plus niet door een fout aan onze kant, dan lossen we dat op of betalen we het aankoopbedrag terug. Daarnaast betalen we binnen 14 dagen na aankoop het volledige bedrag terug als je nog geen Plus-functie hebt gebruikt. Stuur hiervoor een e-mail naar " + c.email + ".",
        ] },
        { h: "7. Aansprakelijkheid", p: [
          "Wij doen ons best om de dienst correct en beschikbaar te houden, maar garanderen niet dat de informatie foutloos is of dat de dienst altijd werkt.",
          "Onze aansprakelijkheid is beperkt tot het bedrag dat je in de twaalf maanden voor de schade aan ons hebt betaald, met een maximum van € 19 per woning. Deze beperking geldt niet bij opzet of bewuste roekeloosheid. Wij zijn niet aansprakelijk voor beslissingen die je neemt op basis van indicatieve informatie, of voor het werk van installateurs.",
        ] },
        { h: "8. Intellectueel eigendom", p: [
          "De software, teksten en vormgeving van Warmtewijs AI zijn van ons of onze licentiegevers. De documenten die je met de dienst maakt, mag je vrij gebruiken voor je eigen woning.",
        ] },
        { h: "9. Klachten", p: [
          `Heb je een klacht? Mail naar ${c.email}. We reageren binnen 14 dagen.`,
        ] },
        { h: "10. Wijzigingen en toepasselijk recht", p: [
          "We kunnen deze voorwaarden aanpassen. De versie die gold op het moment van je aankoop blijft van toepassing op die aankoop.",
          "Op deze voorwaarden is Nederlands recht van toepassing. Als consument behoud je de bescherming van dwingende regels uit het recht van het land waar je woont.",
        ] },
      ],
    };
  return {
    title: "Terms of service",
    intro: `These terms apply to the use of Warmtewijs AI (warmtewijs-ai.vercel.app) and the purchase of Warmtewijs Plus. Warmtewijs AI is offered by ${c.name}, registered with the Dutch Chamber of Commerce (KvK) under number ${c.kvk}, ${c.address}, reachable at ${c.email}.`,
    sections: [
      { h: "1. The service", p: [
        "Warmtewijs AI is an online energy advisor. Using public data (such as the BAG and EP-Online), information you enter or upload, and a calculation model, it gives indicative information about energy-saving measures, costs, savings and subsidies.",
        "Chat answers are written with the help of artificial intelligence (AI). They may contain errors or omissions. Amounts are indicative and based on the assumptions shown with each plan.",
      ] },
      { h: "2. Not financial or building advice", p: [
        "The information is general and indicative. It is not financial advice under the Dutch Financial Supervision Act (Wft), not building or structural advice, and no substitute for an inspection, an energy label or a tradesperson's quote.",
        "Only make decisions about loans, subsidies and building work after checking yourself, for example with RVO, your lender or a licensed adviser. Subsidy rules and amounts can change.",
      ] },
      { h: "3. Use", p: [
        "You may use the service for your own home or on behalf of its owner or occupant. Only upload documents you are allowed to share, and not other people's documents without their consent.",
        "You may not scrape, overload or misuse the service. We may restrict access in case of misuse.",
      ] },
      { h: "4. Warmtewijs Plus", p: [
        "Plus is a one-off purchase of €19 (including VAT) per home. It gives access to the quote checker (up to 5 quotes), the letter to the landlord, the VvE proposal and the quote request.",
        "Plus is activated on the device you pay with. The restore link lets you use Plus on another device. Keep it safe: anyone with the link can use your Plus.",
        "Plus remains available for as long as we offer the service, and in any case for twelve months after purchase.",
      ] },
      { h: "5. Payment", p: [
        "Payments are processed by Stripe. We do not receive or store bank or card details. Stripe emails you a receipt.",
      ] },
      { h: "6. Right of withdrawal and refunds", p: [
        "Plus is digital content that becomes available immediately after payment. At checkout you expressly agree to immediate delivery and acknowledge that you thereby lose your 14-day right of withdrawal.",
        "If Plus doesn't work because of a fault on our side, we will fix it or refund the purchase price. We also refund the full amount within 14 days of purchase if you haven't used any Plus feature yet. Email " + c.email + " to request this.",
      ] },
      { h: "7. Liability", p: [
        "We do our best to keep the service correct and available, but we don't guarantee that the information is error-free or that the service always works.",
        "Our liability is limited to the amount you paid us in the twelve months before the damage, with a maximum of €19 per home. This limit does not apply in case of intent or deliberate recklessness. We are not liable for decisions you make based on indicative information, or for the work of installers.",
      ] },
      { h: "8. Intellectual property", p: [
        "The software, texts and design of Warmtewijs AI belong to us or our licensors. You may freely use the documents you create with the service for your own home.",
      ] },
      { h: "9. Complaints", p: [
        `Have a complaint? Email ${c.email}. We respond within 14 days.`,
      ] },
      { h: "10. Changes and governing law", p: [
        "We may change these terms. The version in force when you bought Plus continues to apply to that purchase.",
        "These terms are governed by Dutch law. As a consumer, you keep the protection of mandatory rules of the law of the country where you live.",
      ] },
    ],
  };
}

export function privacy(lang: Lang): LegalDoc {
  const c = who(lang);
  if (lang === "nl")
    return {
      title: "Privacyverklaring",
      intro: `${c.name} (KvK ${c.kvk}, ${c.address}) is verantwoordelijk voor de verwerking van persoonsgegevens via Warmtewijs AI. Vragen of verzoeken? Mail naar ${c.email}.`,
      sections: [
        { h: "Wat we verwerken en waarom", p: [
          "Adres (postcode en huisnummer): om je woning op te zoeken in openbare registers (BAG via PDOK, en EP-Online van RVO) en om het weer voor jouw plaats te tonen.",
          "Chatberichten: om je vragen te beantwoorden. Voordat een bericht naar de AI gaat, halen we herkenbare nummers zoals BSN, IBAN, e-mailadressen en telefoonnummers er automatisch uit.",
          "Geüploade documenten (jaarafrekening, energielabel, offerte): alleen om de getallen eruit te lezen. We vragen de AI uitdrukkelijk om geen namen, adressen, klantnummers of IBAN's terug te geven. Het document zelf bewaren we niet.",
          "Aankoop van Plus: Stripe verwerkt je betaling en e-mailadres. Wij bewaren alleen een betaalreferentie in een cookie, en bij Stripe het adres van de woning en het aantal gebruikte offertechecks.",
          "Technische gegevens: je IP-adres wordt kort in het werkgeheugen gebruikt om misbruik te beperken (rate limiting). Onze hostingpartij houdt technische logbestanden bij.",
        ] },
        { h: "Grondslagen", p: [
          "Uitvoering van de overeenkomst: om de dienst en Plus te leveren. Gerechtvaardigd belang: om de dienst te beveiligen en misbruik te voorkomen. Wettelijke plicht: betaalgegevens bewaren we zo lang de fiscale bewaarplicht dat vereist (7 jaar).",
        ] },
        { h: "Wat er in je browser blijft", p: [
          "Je gesprek, je woningprofiel en je laatste plan worden opgeslagen in de lokale opslag van je browser (localStorage), niet op onze servers. Met 'vergeet mij' en 'nieuw gesprek' wis je ze.",
        ] },
        { h: "Cookies", p: [
          "We gebruiken alleen functionele cookies: 'lang' onthoudt je taalkeuze en 'ww_plus' onthoudt je Plus-aankoop. We gebruiken geen tracking-, advertentie- of analysecookies. Daarom vragen we niet om toestemming voor cookies.",
        ] },
        { h: "Met wie we gegevens delen", p: [
          "Anthropic (VS): het AI-model dat chatberichten en geüploade documenten verwerkt. Anthropic gebruikt API-gegevens standaard niet om modellen te trainen en bewaart ze volgens zijn eigen bewaarbeleid.",
          "Vercel (VS): hosting van de website en verwerking van verzoeken.",
          "Stripe (Ierland/VS): betalingsverwerking voor Plus.",
          "Kadaster/PDOK en RVO (EP-Online): openbare registers waarin we je adres opzoeken.",
          "Open-Meteo (Zwitserland): weergegevens; we sturen alleen coördinaten van de postcode, niet je adres.",
          "Voor doorgifte buiten de EER rusten deze partijen op een adequaatheidsbesluit (zoals het EU-VS Data Privacy Framework) of op standaardcontractbepalingen. We verkopen geen persoonsgegevens.",
        ] },
        { h: "Bewaartermijnen", p: [
          "Chatberichten en documenten bewaren we zelf niet. Gegevens over Plus-aankopen bewaren we 7 jaar (fiscale bewaarplicht). Technische logbestanden worden na korte tijd automatisch verwijderd door onze hostingpartij.",
        ] },
        { h: "Je rechten", p: [
          `Je hebt recht op inzage, correctie, verwijdering, beperking, bezwaar en overdraagbaarheid van je gegevens. Mail je verzoek naar ${c.email}; we reageren binnen een maand.`,
          "Ben je niet tevreden over hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).",
        ] },
        { h: "Wijzigingen", p: ["We passen deze verklaring aan als de dienst verandert. De datum bovenaan laat zien wanneer dat voor het laatst gebeurde."] },
      ],
    };
  return {
    title: "Privacy statement",
    intro: `${c.name} (KvK ${c.kvk}, ${c.address}) is the controller for personal data processed through Warmtewijs AI. Questions or requests? Email ${c.email}.`,
    sections: [
      { h: "What we process and why", p: [
        "Address (postcode and house number): to look up your home in public registers (BAG via PDOK, and RVO's EP-Online) and to show the weather for your area.",
        "Chat messages: to answer your questions. Before a message is sent to the AI, we automatically remove recognisable numbers such as BSN, IBAN, email addresses and phone numbers.",
        "Uploaded documents (energy bill, energy label, quote): only to read the figures. We explicitly instruct the AI not to return names, addresses, customer numbers or IBANs. We don't store the document itself.",
        "Plus purchases: Stripe processes your payment and email address. We only keep a payment reference in a cookie, and at Stripe the address of the home and the number of quote checks used.",
        "Technical data: your IP address is briefly held in memory to limit abuse (rate limiting). Our hosting provider keeps technical logs.",
      ] },
      { h: "Legal bases", p: [
        "Performance of the contract: to provide the service and Plus. Legitimate interest: to secure the service and prevent misuse. Legal obligation: payment records are kept for as long as Dutch tax law requires (7 years).",
      ] },
      { h: "What stays in your browser", p: [
        "Your conversation, house profile and latest plan are stored in your browser's local storage, not on our servers. 'Forget me' and 'New conversation' delete them.",
      ] },
      { h: "Cookies", p: [
        "We only use functional cookies: 'lang' remembers your language and 'ww_plus' remembers your Plus purchase. We use no tracking, advertising or analytics cookies, so we don't ask for cookie consent.",
      ] },
      { h: "Who we share data with", p: [
        "Anthropic (US): the AI model that processes chat messages and uploaded documents. By default, Anthropic does not use API data to train its models, and retains it according to its own retention policy.",
        "Vercel (US): website hosting and request handling.",
        "Stripe (Ireland/US): payment processing for Plus.",
        "Kadaster/PDOK and RVO (EP-Online): public registers in which we look up your address.",
        "Open-Meteo (Switzerland): weather data; we only send the coordinates of the postcode, not your address.",
        "For transfers outside the EEA, these parties rely on an adequacy decision (such as the EU-US Data Privacy Framework) or standard contractual clauses. We do not sell personal data.",
      ] },
      { h: "Retention", p: [
        "We don't store chat messages or documents ourselves. Plus purchase records are kept for 7 years (tax law). Technical logs are deleted automatically by our hosting provider after a short period.",
      ] },
      { h: "Your rights", p: [
        `You have the right to access, correct, delete, restrict, object to and port your data. Email your request to ${c.email}; we respond within one month.`,
        "If you're unhappy with how we handle your data, you can complain to the Dutch Data Protection Authority (autoriteitpersoonsgegevens.nl).",
      ] },
      { h: "Changes", p: ["We update this statement when the service changes. The date at the top shows when it last changed."] },
    ],
  };
}
