import React from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { useDarkMode } from "../contexts/DarkModeContext";

const PRIVACY_POLICY_TEXT = `Effective Date: August 18, 2026
Last Updated: August 18, 2026

everyCircle ("everyCircle," "EC," "we," "us," or "our") respects your privacy.

This Privacy Policy explains how everyCircle collects, uses, discloses, retains, and protects personal information when you use the everyCircle website, mobile applications, marketplace, and related services (collectively, the "Platform").

This Privacy Policy applies to information collected through the everyCircle website, iOS application, Android application, other everyCircle applications and services, and communications between you and everyCircle.

Please read this Privacy Policy carefully. By using everyCircle, you acknowledge the practices described in this Privacy Policy.

1. Who We Are

everyCircle is a technology platform and marketplace that helps people discover, connect with, communicate with, and transact with businesses, Sellers, Service Providers, and other Members.

everyCircle generally acts as a marketplace and technology provider rather than as the seller or provider of products and services listed by independent Sellers and Service Providers.

everyCircle
6123 Corte de la Reina
San Jose, CA 95120
United States

Privacy Contact:
support@everycircle.com

2. Information We Collect

We collect information that you provide to us, information generated through your use of the Platform, and information that we receive from third parties.

The information we collect depends on how you use everyCircle.

2.1 Information You Provide Directly

You may provide us with information when you:
• create an Account;
• create or update a personal profile;
• create or manage a Business profile;
• create a Seller or Service Provider profile;
• list products or services;
• purchase a product or service;
• communicate with another Member;
• communicate with everyCircle;
• submit a review or rating;
• submit a return or refund request;
• submit a dispute;
• contact customer support;
• participate in promotions or other activities; or
• otherwise use the Platform.

This information may include:
• name;
• username;
• email address;
• telephone number;
• mailing or shipping address;
• billing address;
• profile information;
• Business information;
• professional information;
• photographs and other profile images;
• product and service information;
• reviews and ratings;
• messages and communications;
• customer-support communications;
• transaction information;
• shipping and delivery information;
• return and refund information;
• information you provide when reporting a problem; and

other information you choose to provide.

You should not provide sensitive personal information unless it is reasonably necessary for a particular Platform feature or requested by everyCircle.

3. Payment Information

When you make a purchase or receive payment through everyCircle, payment information may be processed by everyCircle and/or third-party payment processors.

Depending on the payment method and transaction, payment-related information may include:
• payment method;
• transaction amount;
• transaction date and time;
• payment status;
• refund information;
• chargeback information;
• billing information;
• shipping information;
• transaction identifiers;
• limited payment-account information; and

other information necessary to process or manage the Transaction.

Payment card numbers, bank account information, and other sensitive payment credentials may be collected and processed directly by our payment providers rather than by everyCircle.

We may receive limited information from payment providers that is necessary to:
• identify a Transaction;
• confirm payment;
• process refunds;
• manage disputes;
• prevent fraud;
• calculate fees;
• facilitate Seller settlements;
• maintain transaction records; and

comply with legal requirements.

Our payment providers may process your information under their own privacy policies.

4. Information About Transactions

When you participate in a Transaction through everyCircle, we may collect and retain information such as:
• Buyer and Seller identities;
• products or services purchased;
• listing information;
• purchase price;
• taxes and fees;
• shipping information;
• delivery status;
• transaction status;
• return information;
• refund information;
• dispute information;
• communications concerning the Transaction;
• payment status;
• settlement status;
• chargeback information; and

other information necessary to administer the Transaction.

We use this information to operate the marketplace and provide Transaction-related services.

5. Information You Provide in Communications

If you use everyCircle messaging, customer support, dispute resolution, or other communication features, we may collect and retain the communications and related information.

This may include:
• messages;
• attachments;
• photographs;
• documents;
• timestamps;
• participants;
• transaction references; and

other information associated with the communication.

We use communications information to:
• deliver messages;
• facilitate Transactions;
• provide customer support;
• investigate disputes;
• prevent fraud and abuse;
• enforce our Terms and policies;
• protect Members and everyCircle; and

comply with applicable law.

Where permitted by law, we may review communications for these purposes.

6. Information Collected Automatically

When you use everyCircle, we and our service providers may automatically collect certain information about your device and use of the Platform.

This may include:
• IP address;
• device type;
• device model;
• operating system;
• operating-system version;
• browser type;
• mobile application version;
• language and regional settings;
• time zone;
• unique device or application identifiers;
• network information;
• approximate location derived from IP address;
• crash information;
• diagnostic information;
• performance information;
• pages or screens viewed;
• features used;
• searches;
• interactions with listings;
• interactions with businesses and Members;
• dates and times of activity; and

other usage information.

We use this information to operate, secure, analyze, maintain, and improve the Platform.

7. Location Information

Certain everyCircle features may use location information to provide location-based functionality.

Depending on your device settings and the features you use, this may include:
• approximate location;
• precise device location;
• location information you manually provide;
• business or listing locations; and

location information associated with Transactions.

For example, location information may be used to help you:
• find nearby businesses;
• find products or services;
• display relevant marketplace results;
• provide location-based recommendations;
• identify Business locations; or

improve the relevance of Platform features.

You may control certain location permissions through your device settings.

If a feature requires location access, the Platform may request permission before accessing location information.

8. Cookies and Similar Technologies

everyCircle and its service providers may use cookies, pixels, software development kits ("SDKs"), local storage, and similar technologies.

These technologies may be used to:
• keep you signed in;
• remember preferences;
• maintain security;
• understand Platform usage;
• analyze performance;
• measure the effectiveness of features;
• detect fraud;
• improve the Platform; and

provide relevant content or communications.

Additional information is provided in the everyCircle Cookie Policy.

9. Information From Third Parties

We may receive information from third parties when necessary to operate everyCircle.

These sources may include:
• payment processors;
• shipping and delivery providers;
• authentication providers;
• analytics providers;
• fraud-prevention providers;
• identity-verification providers;
• Business partners;
• advertising or marketing providers, where applicable;
• publicly available sources; and

other service providers.

The information we receive depends on the service and may include transaction information, account information, verification information, or technical information.

10. How We Use Personal Information

We may use personal information for the following purposes:

Providing the Platform

We use information to:
• create and maintain Accounts;
• authenticate Members;
• provide marketplace functionality;
• display profiles and listings;
• facilitate Transactions;
• process payments;
• facilitate Seller settlements;
• facilitate returns and refunds;
• provide messaging;
• provide customer support;
• provide dispute resolution; and

provide other services requested by Members.

Operating and Improving everyCircle

We may use information to:
• operate the Platform;
• maintain and improve features;
• understand how Members use everyCircle;
• develop new features;
• personalize the Platform;
• analyze performance;
• troubleshoot problems;
• conduct research; and

improve the user experience.

Safety, Security, and Fraud Prevention

We may use information to:
• detect and prevent fraud;
• detect unauthorized activity;
• protect Accounts;
• protect Members;
• investigate suspicious Transactions;
• prevent abuse;
• maintain Platform security;
• enforce our Terms and policies; and

protect our legal rights.

Communications

We may use information to communicate with you regarding:
• your Account;
• Transactions;
• payments;
• returns;
• refunds;
• disputes;
• security;
• service announcements;
• policy changes;
• customer support; and

other Platform-related matters.

Legal and Compliance Purposes

We may use personal information to:
• comply with applicable laws;
• respond to lawful requests;
• respond to legal process;
• protect our rights;
• enforce agreements;
• investigate suspected violations;
• resolve disputes; and

protect the rights, safety, and property of everyCircle, Members, and others.

11. Personalized Recommendations and Marketplace Features

everyCircle may use information about your activity to personalize your experience.

For example, we may use information about:
• searches;
• listings viewed;
• Businesses viewed;
• purchases;
• Transactions;
• geographic area;
• reviews;
• interactions; and
• other Platform activity

to provide recommendations or more relevant marketplace results.

We may also use aggregated or de-identified information to understand marketplace trends and improve the Platform.

12. Marketing Communications

We may send you communications concerning everyCircle, including information about:
• new features;
• products and services;
• Business listings;
• marketplace opportunities;
• promotions;
• events; and

other information we believe may be relevant to you.

Where required by law, we will obtain consent before sending certain marketing communications.

You may opt out of marketing emails by using the unsubscribe mechanism included in the communication.

Even if you opt out of marketing communications, we may continue to send transactional, security, legal, and other service-related communications.

13. How We Share Personal Information

We may disclose personal information to the following categories of recipients.

Members and Transaction Participants

When necessary to facilitate a Transaction, we may share relevant information between Buyers, Sellers, and Service Providers.

For example, a Seller may receive information necessary to fulfill an order, including the Buyer's name, shipping information, and information concerning the Transaction.

Members may also receive information that you choose to make publicly available through your profile, Business listing, reviews, or other Platform features.

Payment Providers

We share information with payment processors and financial-service providers as necessary to:
• process payments;
• process refunds;
• manage chargebacks;
• facilitate settlements;
• prevent fraud;
• verify accounts; and

comply with legal requirements.

Shipping and Delivery Providers

Where applicable, we may share information with shipping and delivery providers to fulfill Transactions.

Service Providers

We may share information with companies that provide services to everyCircle, including:
• cloud hosting;
• database services;
• analytics;
• customer support;
• communications;
• authentication;
• fraud prevention;
• security;
• payment processing;
• shipping;
• software development;
• error monitoring; and

other technology and operational services.

These providers may access personal information only as reasonably necessary to provide services to everyCircle or as otherwise permitted by law.

14. Third-Party SDKs and Technology Providers

The everyCircle applications may incorporate third-party software development kits, libraries, APIs, or other technologies.

Depending on the services we use, third parties may collect or process information such as:
• device information;
• diagnostic information;
• usage information;
• identifiers;
• IP address;
• location information;
• account information; or

other information necessary to provide their services.

We require our service providers to handle information in accordance with applicable contractual requirements and applicable law.

We will update this Privacy Policy when our material data practices change.

15. Business Transfers

If everyCircle is involved in a merger, acquisition, financing, reorganization, bankruptcy, sale of assets, or similar transaction, personal information may be transferred as part of that transaction.

We will continue to handle personal information in accordance with applicable law.

16. Legal Disclosures and Protection of Rights

We may disclose personal information when reasonably necessary to:
• comply with law;
• respond to subpoenas, court orders, or other legal process;
• respond to governmental requests;
• investigate fraud;
• enforce our Terms;
• protect our rights;
• protect Members;
• protect the security of the Platform;
• prevent physical or financial harm; or

otherwise protect the rights, property, and safety of everyCircle and others.

17. Sale and Sharing of Personal Information

As of the Effective Date of this Privacy Policy, everyCircle does not sell personal information for monetary consideration.

We also do not intend to use personal information for cross-context behavioral advertising unless our practices and applicable disclosures are updated to reflect that activity.

If our practices change in a manner that constitutes a "sale" or "sharing" of personal information under applicable California law, we will update this Privacy Policy and provide any legally required notices and choices.

18. Sensitive Personal Information

Depending on the services you use, everyCircle may process information that could be considered sensitive personal information under applicable law.

We do not intentionally request sensitive personal information unless reasonably necessary for a particular service, transaction, security function, legal requirement, or other legitimate purpose.

You should not submit sensitive personal information through public profiles, reviews, listings, or messaging unless it is reasonably necessary.

Where sensitive personal information is collected, we will handle it in accordance with applicable law.

19. Data Retention

We retain personal information for as long as reasonably necessary to provide the Platform and for legitimate business purposes.

The length of time we retain information depends on factors including:
• the purpose for which the information was collected;
• the nature of the information;
• whether the information is necessary to provide services;
• whether a Transaction remains subject to return, refund, dispute, chargeback, or other obligations;
• legal and regulatory requirements;
• accounting and tax requirements;
• fraud-prevention requirements;
• security requirements;
• enforcement of agreements; and

legitimate business needs.

We may retain certain information after an Account is closed when necessary to:
• comply with law;
• maintain transaction records;
• resolve disputes;
• prevent fraud;
• enforce agreements;
• establish or defend legal claims;
• maintain security; or

satisfy other legitimate legal or business requirements.

When information is no longer reasonably necessary for these purposes, we will delete, de-identify, or otherwise dispose of it in accordance with applicable law.

20. Account Deletion

You may request deletion of your everyCircle Account.

To request deletion, contact:

support@everycircle.com

You may also request deletion through any account-deletion functionality that everyCircle makes available within the Platform.

When we receive a valid deletion request, we will take reasonable steps to delete or de-identify personal information associated with the Account, subject to legal and legitimate business exceptions.

We may retain certain information when required or permitted by law, including information necessary for:
• tax and accounting records;
• fraud prevention;
• security;
• dispute resolution;
• chargebacks;
• refunds;
• legal claims;
• compliance with legal obligations; or

enforcement of agreements.

Deleting your Account does not necessarily delete information that other Members have independently retained or that has been incorporated into records that we are legally required or permitted to retain.

21. California Privacy Rights

If you are a California resident, California law may provide you with additional rights concerning your personal information.

Depending on applicable law, these rights may include:
• the right to know about personal information collected about you;
• the right to access personal information;
• the right to request deletion of personal information;
• the right to correct inaccurate personal information;
• the right to opt out of the sale or sharing of personal information;
• the right to limit certain uses or disclosures of sensitive personal information;
• the right to non-discrimination for exercising privacy rights; and

other rights provided by applicable California law.

These rights are subject to certain exceptions and limitations under applicable law.

22. Right to Know and Access

You may request information about:
• the categories of personal information we collect;
• the categories of sources from which we collect information;
• the purposes for collecting or using personal information;
• the categories of personal information disclosed for business purposes;
• the categories of recipients to whom personal information is disclosed; and

the specific pieces of personal information we have collected about you, subject to applicable legal limitations.

23. Right to Delete

You may request that we delete personal information that we have collected from you.

We may deny or limit a deletion request where an exception under applicable law applies.

If we deny a request, we will explain the reason to the extent required by law.

24. Right to Correct

You may request correction of inaccurate personal information that we maintain about you.

We may consider information reasonably necessary to determine whether the requested correction is appropriate.

25. Right to Opt Out of Sale or Sharing

California residents may have the right to opt out of the sale or sharing of personal information.

As stated above, everyCircle does not currently sell personal information for monetary consideration or engage in cross-context behavioral advertising using personal information.

If this changes, everyCircle will provide the legally required opt-out mechanism.

26. Right to Limit Use of Sensitive Personal Information

California residents may have the right to limit certain uses or disclosures of sensitive personal information under applicable law.

If everyCircle engages in a use subject to this right, we will provide the required method for exercising it.

27. Non-Discrimination

We will not discriminate against you for exercising privacy rights provided by applicable law.

This means that, except as permitted by law, we will not:
• deny you goods or services;
• charge you different prices;
• provide a different level or quality of service; or
• otherwise penalize you

because you exercised a privacy right.

28. How to Exercise California Privacy Rights

You may submit a privacy request by contacting:

support@everycircle.com

Please identify the nature of your request.

We may need to verify your identity before completing certain requests.

We may request information reasonably necessary to confirm that you are the person about whom we collected the information or an authorized representative.

We will not use personal information collected solely for verification purposes for unrelated purposes.

29. Authorized Agents

California residents may authorize another person to submit certain privacy requests on their behalf where permitted by law.

We may require reasonable documentation demonstrating that the person submitting the request is authorized to act on your behalf.

We may also require you to verify your identity directly with us.

30. Response to Privacy Requests

We will respond to valid privacy requests within the time periods required by applicable law.

If additional time is legally permitted and reasonably necessary, we may notify you of the reason for the delay.

If we cannot fulfill a request, we will explain the reason to the extent required by law.

31. Children's Privacy

everyCircle is not directed to children under 13.

We do not knowingly collect personal information from children under 13.

If we learn that we have collected personal information from a child under 13 without appropriate authorization, we will take reasonable steps to delete that information.

If you believe a child under 13 has provided personal information to everyCircle, please contact us at:

support@everycircle.com

32. Security

We use reasonable administrative, technical, and organizational safeguards designed to protect personal information from unauthorized access, disclosure, alteration, or destruction.

These measures may include:
• encryption in transit;
• access controls;
• authentication;
• monitoring;
• logging;
• security testing;
• fraud detection;
• secure infrastructure; and

other reasonable security measures.

No Internet transmission or storage system is completely secure.

Accordingly, we cannot guarantee the absolute security of personal information.

33. International Data Transfers

everyCircle is based in the United States.

If you use everyCircle from outside the United States, your information may be transferred to and processed in the United States or other countries where everyCircle or its service providers operate.

Privacy and data-protection laws in those jurisdictions may differ from the laws where you live.

Where required by applicable law, we will use appropriate safeguards for international transfers of personal information.

34. Third-Party Websites and Services

The Platform may contain links to third-party websites, applications, products, or services.

This Privacy Policy does not apply to the privacy practices of third parties that everyCircle does not control.

We encourage you to review the privacy policies of third-party services before providing them with personal information.

35. Do Not Track

Some web browsers and devices provide "Do Not Track" or similar mechanisms.

Because there is not currently a universally accepted standard for responding to all such signals, everyCircle may not respond to every browser-based Do Not Track signal.

If applicable law requires everyCircle to recognize a particular privacy preference signal, we will process that signal as required by law.

36. Changes to This Privacy Policy

We may update this Privacy Policy from time to time.

When we make material changes, we may provide notice through:
• the everyCircle Platform;
• email;
• an in-app notification;
• a website notice; or

another reasonable method.

The updated Privacy Policy will become effective on the date stated in the updated policy.

We encourage you to review this Privacy Policy periodically.

37. Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or everyCircle's privacy practices, please contact us:

everyCircle
6123 Corte de la Reina
San Jose, CA 95120
United States

Email: support@everycircle.com`;

const NUMBERED_HEADING_PATTERN = /^\d+(?:\.\d+)?\. .+$/;

function renderPrivacyPolicyBlocks(text, darkMode) {
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
        {trimmed}
      </Text>
    );
  });
}

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='PRIVACY POLICY' backgroundColor='#AF52DE' onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, darkMode && styles.darkTitle]}>everyCircle Privacy Policy</Text>
        {renderPrivacyPolicyBlocks(PRIVACY_POLICY_TEXT, darkMode)}

        <TouchableOpacity style={[styles.closeButton, darkMode && styles.darkCloseButton]} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>Close</Text>
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
