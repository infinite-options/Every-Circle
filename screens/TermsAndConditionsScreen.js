import React from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { useDarkMode } from "../contexts/DarkModeContext";

const TERMS_OF_SERVICE_TEXT = `Effective Date: August 18, 2026
Last Updated: August 18, 2026

Welcome to everyCircle.

These Terms of Service and Member Agreement ("Agreement") govern your access to and use of the everyCircle website, mobile applications, services, marketplace, communications tools, and other products and services provided by everyCircle ("everyCircle," "EC," "we," "us," or "our").

By creating an account, accessing or using everyCircle, purchasing or offering products or services through everyCircle, or otherwise using any service provided by everyCircle, you agree to be bound by this Agreement and the other policies and terms incorporated into it.

PLEASE READ THIS AGREEMENT CAREFULLY BEFORE USING EVERYCIRCLE.

If you do not agree to this Agreement, you may not use everyCircle.

1. ABOUT EVERYCIRCLE

everyCircle is a technology platform and marketplace that helps people discover, connect with, communicate with, and transact with businesses, sellers, service providers, and other members.

Depending on the features you use, everyCircle may provide:
business and professional profiles;
product and service listings;
search and discovery tools;
recommendations;
reviews and ratings;
messaging and communications;
purchasing and payment functionality;
transaction and order-management tools;
transaction-protection features;
return and refund processes;
dispute-resolution services;
seller and business tools; and
other features that we may introduce from time to time.

everyCircle is a marketplace and technology platform. It is not the seller, manufacturer, distributor, service provider, or supplier of products or services offered by independent Sellers or Service Providers through the Platform, unless expressly identified as such in connection with a particular transaction.

Except where expressly stated otherwise, the Seller or Service Provider—not everyCircle—is responsible for the products and services that the Seller or Service Provider offers through the Platform.

everyCircle does not generally take title to products offered by Sellers and does not generally purchase products for resale.

2. DEFINITIONS

For purposes of this Agreement:

"Account" means your everyCircle account.

"Buyer" means a Member who purchases or attempts to purchase a product or service through everyCircle.

"Business" means a business, organization, professional, seller, service provider, or other commercial entity using everyCircle.

"Content" means text, photographs, videos, audio, graphics, reviews, ratings, listings, descriptions, messages, data, documents, and other material submitted, posted, transmitted, or displayed through everyCircle.

"EC Content" means Content owned or licensed by everyCircle.

"Member" means any individual or entity that creates an Account or otherwise uses everyCircle where registration or membership is required.

"Platform" means the everyCircle website, mobile applications, software, services, marketplace, APIs, and related systems.

"Seller" means a Member or Business that offers products for sale through everyCircle.

"Service Provider" means a Member or Business that offers services through everyCircle.

"Transaction" means a purchase, sale, order, service engagement, or other commercial transaction facilitated through everyCircle.

Additional terms may be defined in the Marketplace Terms, Payment Terms, Seller & Service Provider Agreement, Return and Refund Policy, or other policies incorporated into this Agreement.

3. ELIGIBILITY

You must be legally capable of entering into a binding agreement to use everyCircle.

If you are using everyCircle on behalf of a business or other organization, you represent and warrant that:
you are authorized to act on behalf of that organization;
you have authority to bind the organization to this Agreement; and
the organization agrees to this Agreement.

everyCircle may impose additional eligibility requirements for particular services, transactions, products, or categories.

You may not use everyCircle if your use is prohibited by applicable law.

4. CREATING AND MAINTAINING AN ACCOUNT

Certain everyCircle features require an Account.

You agree to provide accurate, current, and complete information and to maintain the accuracy of that information.

You are responsible for:
maintaining the confidentiality of your login credentials;
all activity occurring through your Account;
notifying us promptly of unauthorized access;
maintaining accurate contact information; and
complying with applicable laws when using your Account.

You may not:
create an Account using another person's identity without authorization;
create an Account for someone else without authorization;
impersonate another person or Business;
create multiple Accounts for the purpose of evading restrictions;
use false or misleading information; or
transfer your Account without our permission.

We may require additional information to verify your identity, Business, or eligibility for particular features.

5. MEMBER RESPONSIBILITIES

You agree to use everyCircle honestly, lawfully, and in accordance with this Agreement.

You are responsible for your conduct and Content on the Platform.

You must not use everyCircle to:
violate applicable laws or regulations;
defraud or deceive another person;
misrepresent products, services, businesses, or identities;
infringe intellectual-property rights;
distribute malware or malicious software;
interfere with the operation of the Platform;
circumvent security measures;
manipulate ratings or reviews;
harass, threaten, or abuse other Members;
collect personal information without authorization;
engage in spam or unauthorized solicitation;
circumvent applicable everyCircle fees;
conduct transactions designed to evade everyCircle policies;
use everyCircle for prohibited products or services; or
engage in conduct that may harm Members, Businesses, everyCircle, or the integrity of the Platform.

Additional requirements are contained in the Community Guidelines and Prohibited Products and Services Policy, which are incorporated into this Agreement.

6. EVERYCIRCLE'S ROLE AS A MARKETPLACE

everyCircle provides a marketplace and technology platform through which Buyers, Sellers, Businesses, Service Providers, and other Members may discover one another, communicate, and conduct Transactions.

everyCircle is not generally a party to the underlying purchase or service agreement between a Buyer and a Seller or Service Provider.

Unless expressly stated otherwise:
Sellers are independent businesses or individuals;
Service Providers are independent businesses or individuals;
Sellers are responsible for the products they offer;
Service Providers are responsible for the services they provide;
Buyers are responsible for reviewing listings and transaction terms before purchasing;
everyCircle does not manufacture, own, possess, inspect, or control products offered by independent Sellers;
everyCircle does not generally provide the services offered by independent Service Providers;
everyCircle does not guarantee the quality, safety, legality, authenticity, availability, or accuracy of products or services offered by Members; and
everyCircle does not guarantee that a Buyer or Seller will perform its obligations in a Transaction.

Nothing in this Agreement creates a partnership, joint venture, employment relationship, franchise, fiduciary relationship, or agency relationship between everyCircle and a Seller, Service Provider, or Buyer.

7. LISTINGS AND PRODUCT OR SERVICE INFORMATION

Sellers and Service Providers are responsible for ensuring that their listings are accurate and complete.

Listings must accurately describe, as applicable:
the product or service;
condition;
price;
availability;
material characteristics;
limitations;
applicable warranties;
shipping or fulfillment requirements; and
applicable return or cancellation conditions.

Sellers and Service Providers are responsible for ensuring that their listings and Transactions comply with applicable laws and regulations.

everyCircle may remove, modify, restrict, or suspend listings that violate this Agreement, applicable policies, or applicable law.

everyCircle does not guarantee that listings will remain available or that a particular product or service will remain available at a particular price.

8. BUYER RESPONSIBILITIES

Before completing a Transaction, Buyers are responsible for reviewing the applicable listing and transaction information.

You should consider:
price;
taxes;
shipping charges;
delivery estimates;
product condition;
return terms;
warranties;
service terms; and
other information presented before purchase.

Once a Transaction is completed, the Buyer may be subject to the applicable cancellation, return, refund, and dispute policies.

9. ORDERS AND TRANSACTIONS

When a Buyer submits an order through everyCircle, the order may be subject to acceptance by the Seller.

everyCircle may facilitate communications and payment processing but does not guarantee that a Seller will accept or fulfill every order.

everyCircle may cancel, restrict, or suspend a Transaction when reasonably necessary because of:
suspected fraud;
payment failure;
inaccurate pricing;
inventory or availability issues;
suspected violation of law or policy;
account restrictions;
security concerns;
payment-provider requirements; or
other legitimate operational or risk-management reasons.

10. PRICES, TAXES, AND FEES

Prices are established by Sellers or Service Providers unless otherwise indicated.

Applicable taxes, shipping charges, service charges, marketplace fees, or other charges may be added to the purchase price.

everyCircle may calculate or facilitate the collection of applicable taxes where required by law.

Sellers and Service Providers remain responsible for their own tax obligations except to the extent applicable law requires everyCircle or its payment providers to collect, report, or remit taxes.

everyCircle may charge Buyers, Sellers, Businesses, or Service Providers fees described in applicable fee schedules or transaction disclosures.

11. PAYMENTS

Payments made through everyCircle may be processed by everyCircle's designated payment processor or other third-party payment provider.

You authorize everyCircle and its designated payment providers to process payments and other amounts associated with your Transactions.

You agree to provide accurate payment information and to authorize applicable charges.

everyCircle does not guarantee that a particular payment method will always be available.

Payment processing may be subject to the terms and conditions of the applicable payment provider.

Additional payment provisions are contained in the Payment Terms, which are incorporated into this Agreement.

12. SELLER SETTLEMENTS AND PAYMENT TIMING

Amounts associated with Transactions conducted through everyCircle may be subject to settlement procedures established by everyCircle and its payment providers.

Seller payment is not necessarily immediate following a Buyer's payment.

The timing and availability of amounts payable to Sellers or Service Providers may depend on a variety of factors, including:
payment status;
delivery status;
transaction status;
account status;
Seller or Service Provider history;
applicable return or cancellation periods;
refunds;
disputes;
chargebacks;
suspected fraud or other security concerns;
payment-processing requirements;
payment reversals;
Seller or Service Provider reserves;
negative balances;
legal or regulatory requirements;
compliance reviews;
violations or suspected violations of this Agreement; and
other legitimate risk-management, compliance, or operational considerations.

everyCircle may delay, restrict, suspend, offset, adjust, or reverse a settlement when reasonably necessary to address these circumstances.

everyCircle does not guarantee that amounts associated with a Transaction will become available to a Seller or Service Provider at a particular time unless a specific settlement commitment has been expressly provided in the applicable terms or otherwise in writing.

Nothing in this Agreement requires everyCircle to maintain customer funds for a particular period of time or to release funds based solely on the expiration of a return period.

Additional settlement provisions are contained in the Payment Terms and Seller & Service Provider Agreement.

13. RETURNS, REFUNDS, AND CANCELLATIONS

Returns, refunds, and cancellations are governed by the applicable Return and Refund Policy, listing terms, Seller terms, and Payment Terms.

Depending on the circumstances, a Buyer may be entitled to:
cancel an order;
return a product;
receive a full refund;
receive a partial refund;
obtain a replacement; or
pursue another remedy.

Not every product or service will necessarily be eligible for return or refund.

Certain products, services, customized items, digital products, perishables, or other categories may be subject to different rules.

everyCircle may process refunds through the applicable payment processor.

Where a refund is required after a Seller has received settlement, the Seller may remain responsible for the applicable amount, and everyCircle may recover amounts owed through methods permitted by the applicable Seller agreement and applicable law.

14. TRANSACTION PROTECTION

everyCircle may offer transaction-protection features designed to provide Buyers and Sellers with additional protection when conducting Transactions through the Platform.

Transaction protection may include:
verification requirements;
delivery confirmation;
return periods;
dispute resolution;
payment adjustments;
Seller reserves;
fraud monitoring;
transaction reviews; and
other risk-management measures.

Transaction protection is subject to the applicable policies and limitations.

Every-Circle transaction protection is not insurance, an escrow service, or a guarantee of performance by a Buyer or Seller.

Transaction protection does not guarantee that every loss, defect, dispute, fraud, return, or Transaction will be covered.

15. DISPUTES BETWEEN BUYERS AND SELLERS

everyCircle encourages Buyers and Sellers to communicate directly and attempt to resolve Transaction issues in good faith.

everyCircle may provide a dispute-resolution process when a Buyer or Seller cannot resolve an issue directly.

The applicable process may include:
a Buyer or Seller submits a dispute;
the other party is given an opportunity to respond;
everyCircle reviews available information;
everyCircle may request additional documentation;
everyCircle may communicate with either party;
everyCircle may make a determination under the applicable marketplace policies; and
everyCircle may implement an appropriate payment, refund, account, listing, or other Platform action.

everyCircle's determination under its marketplace policies does not necessarily determine the parties' legal rights outside the Platform.

Additional procedures are contained in the Dispute Resolution Policy.

16. REVIEWS AND RATINGS

everyCircle may allow Members to submit reviews, ratings, recommendations, and other feedback.

Reviews must reflect the reviewer's genuine experience.

You may not:
submit fake reviews;
review a transaction you did not experience;
offer compensation for a particular rating;
threaten another Member over a review;
manipulate ratings;
submit reviews on behalf of another person;
impersonate another reviewer; or
coordinate fraudulent review activity.

everyCircle may remove or restrict Content that violates its policies or applicable law.

everyCircle does not guarantee that reviews or ratings are accurate or complete.

17. MESSAGING AND COMMUNICATIONS

everyCircle may provide messaging and other communication features.

You agree to use these features responsibly and only for legitimate purposes.

You may not use everyCircle communications to:
harass or threaten another person;
send spam;
distribute malware;
solicit unlawful transactions;
collect information improperly;
circumvent everyCircle policies or fees; or
engage in fraudulent or deceptive conduct.

To the extent permitted by applicable law, everyCircle may monitor, review, or preserve communications for safety, security, fraud prevention, policy enforcement, dispute resolution, or other legitimate purposes.

18. USER CONTENT

You may submit Content to everyCircle.

You retain ownership of Content that you own, subject to the rights granted below.

By submitting Content to everyCircle, you grant everyCircle a non-exclusive, worldwide, royalty-free, transferable, sublicensable license to host, store, reproduce, modify, display, distribute, communicate, and otherwise use that Content as reasonably necessary to:
operate everyCircle;
provide Platform services;
display listings and profiles;
promote the Platform;
improve products and services;
develop new features;
maintain security; and
comply with law.

You represent that you have the rights necessary to grant this license.

You are responsible for your Content.

19. PROHIBITED CONTENT AND ACTIVITIES

You may not use everyCircle to offer, advertise, sell, purchase, or facilitate products or services that are prohibited by applicable law or everyCircle policy.

everyCircle may establish category-specific restrictions.

everyCircle may remove Content, suspend listings, restrict Accounts, cancel Transactions, or take other appropriate action when prohibited activity is suspected.

20. INTELLECTUAL PROPERTY

The everyCircle Platform, including its software, design, logos, trademarks, interfaces, graphics, databases, and other EC Content, is owned by or licensed to everyCircle and is protected by applicable intellectual-property laws.

Except as expressly permitted, you may not:
copy;
modify;
distribute;
sell;
lease;
sublicense;
reverse engineer;
extract;
scrape;
reproduce; or
create derivative works from
everyCircle's intellectual property.

"everyCircle" and related names, logos, and marks are trademarks or service marks of everyCircle or their respective owners.

21. FEEDBACK

If you provide suggestions, ideas, recommendations, or other feedback concerning everyCircle, you grant everyCircle the right to use that feedback without restriction or compensation to you.

22. THIRD-PARTY SERVICES

everyCircle may integrate with third-party services, including payment processors, shipping providers, authentication providers, analytics services, communication providers, and other technology providers.

Third-party services may have their own terms and privacy policies.

everyCircle is not responsible for the acts or omissions of third-party service providers except as required by applicable law.

23. PAYMENT PROVIDERS

Payments may be processed through third-party payment providers.

By using payment functionality, you may also be required to accept the payment provider's applicable terms.

Payment providers may independently impose:
identity-verification requirements;
transaction limits;
reserves;
payment restrictions;
fraud controls;
account restrictions; or
other requirements.

everyCircle may be required to comply with such requirements.

24. ACCOUNT SUSPENSION AND TERMINATION

everyCircle may suspend, restrict, or terminate an Account if we reasonably believe that:
you violated this Agreement;
you violated an EC policy;
you violated applicable law;
your Account presents a security or fraud risk;
your conduct harms another Member;
your payment activity presents unacceptable risk;
you provided false or misleading information; or
continued use of the Platform creates legal, financial, operational, or security risk.

Where appropriate and permitted by applicable law, everyCircle may provide notice and an opportunity to address the issue.

Termination does not eliminate obligations that by their nature should survive termination.

25. EFFECT OF TERMINATION ON TRANSACTIONS

Closing or suspending an Account does not necessarily cancel Transactions already initiated.

everyCircle may continue processing:
pending orders;
refunds;
returns;
disputes;
chargebacks;
payment adjustments;
Seller settlements; or
other Transaction-related matters
after an Account has been suspended or closed.

26. SELLER BALANCES AND AMOUNTS OWED

If you are a Seller or Service Provider, you may owe everyCircle amounts arising from:
refunds;
chargebacks;
Transaction reversals;
fees;
penalties permitted under applicable agreements;
negative balances;
customer refunds;
payment-provider adjustments; or
other amounts properly attributable to your activity.

Where permitted by applicable law and agreement, everyCircle may recover amounts owed by:
offsetting amounts against future Seller settlements;
using available Seller balances;
applying applicable reserves;
charging a valid payment method;
requesting repayment; or
pursuing other lawful collection methods.

27. FRAUD AND SECURITY

everyCircle may use automated and manual systems to detect and prevent:
fraud;
identity theft;
account takeover;
payment fraud;
fake listings;
counterfeit products;
abuse;
manipulation;
security threats; and
other prohibited activity.

These systems may result in temporary holds, additional verification, Transaction cancellation, or Account restrictions.

No fraud-prevention system is perfect, and everyCircle does not guarantee that fraudulent activity will never occur.

28. PRIVACY

Your use of everyCircle is subject to the everyCircle Privacy Policy, which is incorporated into this Agreement.

The Privacy Policy explains how everyCircle collects, uses, discloses, retains, and otherwise processes personal information.

The Privacy Policy is available through the everyCircle Platform.

29. COMMUNITY GUIDELINES

Your use of everyCircle's community features is subject to the everyCircle Community Guidelines, which are incorporated into this Agreement.

The Community Guidelines are available through the everyCircle Platform.

30. COOKIE POLICY

everyCircle's use of cookies and similar technologies is described in the everyCircle Cookie Policy, which is incorporated into this Agreement.

The Cookie Policy is available through the everyCircle Platform.

31. OTHER POLICIES AND TERMS

The following documents, as applicable, are incorporated into this Agreement:
Privacy Policy;
Community Guidelines;
Cookie Policy;
Marketplace Terms;
Payment Terms;
Seller & Service Provider Agreement;
Return and Refund Policy;
Dispute Resolution Policy;
Prohibited Products and Services Policy;
Seller Fee Schedule; and
other policies or terms expressly incorporated into this Agreement.

If there is a conflict between this Agreement and a transaction-specific term, the more specific transaction term will control with respect to that Transaction, unless otherwise stated.

32. DISCLAIMER OF WARRANTIES

TO THE MAXIMUM EXTENT PERMITTED BY LAW, EVERYCIRCLE PROVIDES THE PLATFORM ON AN "AS IS" AND "AS AVAILABLE" BASIS.

EVERYCIRCLE DOES NOT WARRANT THAT:
THE PLATFORM WILL ALWAYS BE AVAILABLE;
THE PLATFORM WILL BE ERROR-FREE;
INFORMATION WILL ALWAYS BE ACCURATE;
PRODUCTS OR SERVICES OFFERED BY MEMBERS WILL BE AVAILABLE;
PRODUCTS OR SERVICES WILL MEET A BUYER'S EXPECTATIONS;
TRANSACTIONS WILL ALWAYS BE COMPLETED;
SELLERS WILL FULFILL THEIR OBLIGATIONS;
BUYERS WILL PAY THEIR OBLIGATIONS; OR
THE PLATFORM WILL BE FREE FROM SECURITY VULNERABILITIES.

EVERYCIRCLE DOES NOT WARRANT OR GUARANTEE THE QUALITY, SAFETY, LEGALITY, AUTHENTICITY, CONDITION, OR PERFORMANCE OF PRODUCTS OR SERVICES OFFERED BY INDEPENDENT SELLERS OR SERVICE PROVIDERS.

NOTHING IN THIS SECTION DISCLAIMS A WARRANTY OR RIGHT THAT CANNOT LAWFULLY BE DISCLAIMED.

33. LIMITATION OF LIABILITY

TO THE MAXIMUM EXTENT PERMITTED BY LAW, EVERYCIRCLE AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AND AGENTS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM OR RELATING TO YOUR USE OF THE PLATFORM.

TO THE MAXIMUM EXTENT PERMITTED BY LAW, EVERYCIRCLE'S TOTAL LIABILITY ARISING OUT OF OR RELATING TO THE PLATFORM OR THIS AGREEMENT WILL NOT EXCEED THE GREATER OF:
THE AMOUNT YOU PAID DIRECTLY TO EVERYCIRCLE DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM; OR
ONE HUNDRED DOLLARS ($100).

This limitation does not apply where prohibited by applicable law.

Nothing in this Agreement limits liability that cannot legally be limited or excluded.

34. INDEMNIFICATION

To the maximum extent permitted by law, you agree to defend, indemnify, and hold harmless everyCircle and its affiliates, officers, directors, employees, contractors, and agents from claims, liabilities, damages, losses, costs, and expenses, including reasonable attorneys' fees, arising from or related to:
your violation of this Agreement;
your violation of applicable law;
your Content;
your products or services;
your Transactions;
your fraud, negligence, or misconduct; or
your violation of another person's rights.

This section does not require indemnification to the extent prohibited by applicable law.

35. DISPUTE RESOLUTION

Before initiating formal legal proceedings concerning a dispute with everyCircle, you are encouraged to contact everyCircle and provide a reasonable opportunity to resolve the dispute informally, unless applicable law permits or requires otherwise.

You may contact us at:
support@everycircle.com

everyCircle
San Jose, CA 95120

Any mandatory arbitration provision, class-action waiver, jury-trial waiver, or other dispute-resolution provision applicable to your use of everyCircle will be provided in accordance with applicable law and may be contained in a separate agreement or section adopted by everyCircle.

Nothing in this Agreement prevents you from exercising rights that cannot lawfully be waived.

36. GOVERNING LAW

Except where prohibited by applicable law, this Agreement will be governed by the laws of the State of California, without regard to conflict-of-law principles.

Nothing in this section deprives a consumer of rights that cannot lawfully be waived under the laws applicable to that consumer.

37. CHANGES TO THIS AGREEMENT

We may modify this Agreement from time to time.

When we make material changes, we may provide notice through:
email;
an in-Platform notice;
a notification;
an updated Agreement presented for acceptance; or
other reasonable means.

The updated Agreement will become effective on the date specified in the updated Agreement.

Where applicable law requires affirmative acceptance of material changes, we will obtain that acceptance.

Your continued use of everyCircle after the effective date of a revised Agreement constitutes acceptance of the revised Agreement to the extent permitted by applicable law.

38. ELECTRONIC COMMUNICATIONS AND SIGNATURES

You agree that everyCircle may communicate with you electronically regarding:
your Account;
Transactions;
payments;
refunds;
disputes;
security;
policy changes;
legal notices; and
other matters relating to your use of the Platform.

Electronic notices and agreements may satisfy legal requirements that communications be in writing, to the extent permitted by applicable law.

Your electronic acceptance of this Agreement may constitute your legally binding signature where permitted by applicable law.

39. NOTICES

Legal notices to everyCircle should be sent to:

everyCircle
San Jose, CA 95120

Email: support@everycircle.com

Notices to Members may be sent to the email address or other contact information associated with the Member's Account.

40. ASSIGNMENT

You may not assign or transfer this Agreement or your Account without everyCircle's prior written consent.

everyCircle may assign or transfer this Agreement in connection with:
a merger;
acquisition;
corporate reorganization;
sale of substantially all assets;
financing; or
similar transaction.

41. SEVERABILITY

If any provision of this Agreement is determined to be invalid or unenforceable, that provision will be enforced to the maximum extent permitted by law and the remaining provisions will remain in effect.

42. NO WAIVER

everyCircle's failure to enforce a provision of this Agreement does not constitute a waiver of our right to enforce that provision later.

43. ENTIRE AGREEMENT

This Agreement, together with the policies and agreements incorporated into it, constitutes the entire agreement between you and everyCircle concerning your use of the Platform, except where a separate written agreement applies.

44. CONTACT US

If you have questions about this Agreement, contact:

everyCircle
Email: support@everycircle.com
Mail:
everyCircle
San Jose, CA 95120

45. MEMBER ACKNOWLEDGMENT AND ACCEPTANCE

By creating an everyCircle Account or using the Platform where acceptance is required, you acknowledge that:
you have read this Terms of Service and Member Agreement;
you understand it;
you agree to be bound by it;
you have reviewed the policies incorporated into it; and
you understand that additional terms may apply to particular everyCircle features, Transactions, purchases, sales, or services.

By Clicking Accept I acknowledge that I have read and agree to the everyCircle Terms of Service and Member Agreement, including the policies and terms incorporated into it.

everyCircle
Terms of Service and Member Agreement
Effective Date: August 18, 2026
Last Updated: August 18, 2026`;

const NUMBERED_HEADING_PATTERN = /^\d+(?:\.\d+)?\. .+$/;
const LIST_ITEM_SEMI_PATTERN = /;\s*(and|or)?$/i;

function formatTermsListBlock(block) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3 || !lines[0].endsWith(":")) return block;

  const items = lines.slice(1);
  const semicolonCount = items.filter((line) => LIST_ITEM_SEMI_PATTERN.test(line)).length;
  if (semicolonCount < 1 || items.length < 2) return block;

  const merged = [];
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    while (i + 1 < items.length && !LIST_ITEM_SEMI_PATTERN.test(item) && !item.endsWith(".")) {
      i += 1;
      item = `${item} ${items[i]}`;
    }
    merged.push(item.startsWith("• ") ? item : `• ${item}`);
  }

  return [lines[0], ...merged].join("\n");
}

function renderTermsBlocks(text, darkMode) {
  return text.split("\n\n").map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    const isNumberedHeading = NUMBERED_HEADING_PATTERN.test(trimmed) && !trimmed.includes("\n");

    if (isNumberedHeading) {
      return (
        <Text key={`heading-${index}`} style={[styles.sectionHeading, darkMode && styles.darkSectionHeading]}>
          {trimmed}
        </Text>
      );
    }

    return (
      <Text key={`block-${index}`} style={[styles.body, darkMode && styles.darkBody]}>
        {formatTermsListBlock(trimmed)}
      </Text>
    );
  });
}

export default function TermsAndConditionsScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  const handleAccept = async () => {
    await AsyncStorage.setItem("termsAccepted", JSON.stringify(true));
    navigation.navigate("Settings");
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='TERMS & CONDITIONS' backgroundColor='#AF52DE' onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, darkMode && styles.darkTitle]}>everyCircle Terms of Service and Member Agreement</Text>
        {renderTermsBlocks(TERMS_OF_SERVICE_TEXT, darkMode)}

        <TouchableOpacity style={[styles.closeButton, darkMode && styles.darkCloseButton]} onPress={handleAccept} accessibilityRole='button' accessibilityLabel='Accept terms and return to Settings'>
          <Text style={styles.closeButtonText}>Accept</Text>
        </TouchableOpacity>

        <View style={styles.bottomBuffer} />
      </ScrollView>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  darkContainer: { backgroundColor: "#1a1a1a" },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#000",
  },
  darkTitle: {
    color: "#ffffff",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
    marginBottom: 16,
  },
  darkBody: {
    color: "#cccccc",
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 28,
    color: "#111",
    marginTop: 4,
    marginBottom: 8,
  },
  darkSectionHeading: {
    color: "#ffffff",
  },
  closeButton: {
    marginTop: 30,
    alignSelf: "center",
    backgroundColor: "#AF52DE",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 6,
  },
  darkCloseButton: {
    backgroundColor: "#AF52DE",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  bottomBuffer: {
    height: 100,
    marginBottom: 20,
  },
});
