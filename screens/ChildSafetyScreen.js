import React from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { useDarkMode } from "../contexts/DarkModeContext";

const CHILD_SAFETY_POLICY_TEXT = `Last updated: September 3, 2026

1. Our Commitment to Child Safety

EveryCircle is committed to maintaining a safe environment for its users and has a zero-tolerance policy toward child sexual abuse and exploitation (CSAE).

This Child Safety & CSAE Policy applies to the EveryCircle application, website, services, and content and interactions made available through EveryCircle.

EveryCircle strictly prohibits any content, conduct, or activity that sexually exploits, abuses, or endangers children.

EveryCircle will take appropriate action when it becomes aware of suspected child sexual abuse, exploitation, or child sexual abuse material (CSAM), consistent with applicable law and this policy.

2. Prohibited Child Sexual Abuse and Exploitation

Users may not use EveryCircle to:
• Sexually exploit or abuse a child.
• Groom, solicit, manipulate, or otherwise prepare a child for sexual exploitation or abuse.
• Engage in or facilitate sexual activity involving a child.
• Produce, request, possess, upload, transmit, distribute, or share child sexual abuse material (CSAM).
• Sexualize minors or encourage the sexual exploitation of minors.
• Engage in sextortion or threaten a child using actual or alleged intimate images.
• Advertise, solicit, arrange, or facilitate the commercial sexual exploitation or trafficking of a child.
• Facilitate contact between an adult and a child for the purpose of sexual exploitation or abuse.
• Use EveryCircle to obtain sexual images or other sexually exploitative material involving a child.
• Attempt to circumvent EveryCircle's safety or moderation systems to facilitate CSAE.
• Encourage, promote, assist, or provide instructions for any prohibited conduct involving the sexual abuse or exploitation of children.

These prohibitions apply to all content and activity supported by EveryCircle, including user profiles, photographs, videos, recommendations, offerings, listings, reviews, comments, messages, and other user-generated content.

3. Child Sexual Abuse Material (CSAM)

EveryCircle does not permit the creation, upload, storage, sharing, distribution, solicitation, or promotion of CSAM.

Users must not upload CSAM to EveryCircle, including for the purpose of reporting it. Suspected CSAM should instead be reported through EveryCircle's reporting mechanisms or by contacting EveryCircle Support.

If EveryCircle becomes aware of suspected CSAM or other content involving the sexual exploitation or abuse of a child, EveryCircle may take appropriate action, including:
• Removing or restricting access to the reported content.
• Restricting, suspending, or terminating accounts involved in prohibited activity.
• Preserving relevant information when appropriate and legally permitted.
• Reporting suspected CSAM or child sexual exploitation to appropriate authorities or designated organizations when required by applicable law.
• Cooperating with lawful requests from law enforcement, child-safety organizations, and other authorized authorities.

4. Community Reporting and Safety Measures

EveryCircle provides users with the ability to flag or report a business, user profile, or offering that they believe violates EveryCircle's Terms of Service, Community Guidelines, Child Safety & CSAE Policy, or other applicable policies.

EveryCircle uses community reporting as one part of its overall safety and moderation system.

Automatic Temporary Removal

When a business, profile, or offering receives three or more independent user flags, EveryCircle automatically removes that business, profile, or offering from public view and places it into an internal review process.

The reported business, profile, or offering remains unavailable to users while the internal review is conducted.

Following review, EveryCircle may:
• Restore the business, profile, or offering if the reports are determined to be unfounded.
• Remove or restrict the reported content.
• Suspend or terminate the associated user account.
• Take additional enforcement action under EveryCircle's policies.
• Report suspected illegal activity to appropriate authorities when required or appropriate.

An automatic removal following three flags is a precautionary safety measure and does not, by itself, constitute a finding that the reported content or conduct violated the law or EveryCircle's policies.

Immediate Safety Action

EveryCircle may take immediate action without waiting for three flags when it identifies content or conduct presenting a serious or urgent safety concern.

This may include suspected:
• Child sexual abuse or exploitation.
• CSAM.
• Grooming.
• Sextortion.
• Child trafficking or commercial sexual exploitation.
• Credible threats of violence or other serious harm.
• Other potentially illegal or dangerous activity.

EveryCircle may immediately restrict access to the relevant content, business, profile, offering, or account and conduct an internal review.

5. Reporting Child Safety Concerns

Users should report suspected CSAE, CSAM, grooming, sexual exploitation of a child, or other child-safety concerns through the reporting functionality available within the EveryCircle application.

Users may also contact:

EveryCircle Support
Email: support@everycircle.com

Reports should include sufficient information for EveryCircle to identify and investigate the reported account, content, business, profile, offering, or conduct.

EveryCircle takes reports involving the safety of children seriously and will review reports and take appropriate action consistent with this policy, applicable law, and the circumstances of the report.

Users should not upload or send suspected CSAM to EveryCircle for the purpose of making a report.

6. Enforcement

EveryCircle may take action against accounts, content, businesses, profiles, offerings, or other activity that violates this policy.

Depending on the circumstances, enforcement may include:
• Removal of content.
• Temporary restriction or removal from public view.
• Restriction of content visibility.
• Suspension of an account.
• Permanent termination of an account.
• Restriction or termination of access to EveryCircle services.
• Preservation of information when appropriate and legally permitted.
• Reporting to appropriate authorities or child-safety organizations.

EveryCircle may take action based on user reports, internal investigations, automated or other safety measures, information provided by users, or information received from law enforcement or other authorized organizations.

7. Cooperation With Authorities

EveryCircle will comply with applicable child-safety laws and legal requirements.

Where required by applicable law, EveryCircle will report confirmed or suspected CSAM or child sexual exploitation to the appropriate authorities or designated reporting organizations.

For users and activity in the United States, this may include reporting to the National Center for Missing & Exploited Children (NCMEC) when required by applicable law.

EveryCircle may also cooperate with law enforcement and other authorized authorities investigating child sexual abuse or exploitation.

8. Child Safety Point of Contact

EveryCircle maintains a designated point of contact for child-safety matters.

The child-safety point of contact is responsible for receiving and responding to child-safety concerns and coordinating appropriate enforcement and reporting procedures.

Child Safety Contact: EveryCircle Support
Email: support@everycircle.com

This contact may also receive communications from Google Play or other authorized parties concerning potential child sexual abuse and exploitation on the EveryCircle platform.

9. User-Generated Content

EveryCircle contains user-generated content, which may include profiles, recommendations, photographs, reviews, offerings, listings, comments, messages, and other content submitted by users.

Users are responsible for complying with EveryCircle's Terms of Service, Community Guidelines, and this Child Safety & CSAE Policy.

EveryCircle prohibits user-generated content or behavior that facilitates, promotes, depicts, solicits, or encourages the sexual abuse or exploitation of children.

EveryCircle will take appropriate action when it becomes aware of prohibited content or conduct.

10. Protection of Children

EveryCircle does not permit the platform to be used to facilitate sexual contact, grooming, sexual exploitation, trafficking, or abuse of children.

Users must not use EveryCircle to establish or maintain relationships with children for the purpose of sexual exploitation, abuse, grooming, sextortion, trafficking, or obtaining sexual imagery.

Any attempt to use EveryCircle for these purposes may result in immediate account termination and, where appropriate or legally required, reporting to authorities.

11. No Retaliation for Good-Faith Reports

EveryCircle prohibits retaliation against users who make good-faith reports concerning child safety, CSAE, or CSAM.

False reports or abuse of EveryCircle's reporting system may violate EveryCircle's Terms of Service or Community Guidelines and may result in enforcement action.

The three-flag automatic removal mechanism is intended as a safety measure and does not prevent EveryCircle from investigating reports individually or taking action based on the circumstances of a particular report.

12. Privacy and Information Handling

EveryCircle handles information associated with reports, investigations, and enforcement actions in accordance with its Privacy Policy and applicable law.

EveryCircle may retain and disclose information relating to suspected CSAE or CSAM when reasonably necessary to investigate violations, protect users, comply with legal obligations, or respond to lawful requests from authorities.

13. Updates to This Policy

EveryCircle may update this Child Safety & CSAE Policy from time to time to reflect changes in applicable law, Google Play requirements, safety practices, or EveryCircle's services.

The current version of this policy will remain publicly accessible on the EveryCircle website.

14. Contact

Questions or concerns regarding child safety, CSAE, CSAM, or this policy may be directed to:

EveryCircle Support
support@everycircle.com

EveryCircle is committed to maintaining a platform that does not facilitate child sexual abuse or exploitation and to taking appropriate action when such activity is identified.`;

const NUMBERED_HEADING_PATTERN = /^\d+(?:\.\d+)?\. .+$/;
const SUBHEADING_PATTERN = /^[A-Z][A-Za-z0-9 &'/-]+$/;

function renderPolicyBlocks(text, darkMode) {
  return text.split("\n\n").map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    const isNumberedHeading = NUMBERED_HEADING_PATTERN.test(trimmed) && !trimmed.includes("\n");
    const isSubheading = !isNumberedHeading && SUBHEADING_PATTERN.test(trimmed) && !trimmed.includes("\n");

    if (isNumberedHeading || isSubheading) {
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

export default function ChildSafetyScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <AppHeader title='CHILD SAFETY' backgroundColor='#AF52DE' onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, darkMode && styles.darkTitle]}>Every Circle Child Safety & Child Sexual Abuse and Exploitation (CSAE) Policy</Text>
        {renderPolicyBlocks(CHILD_SAFETY_POLICY_TEXT, darkMode)}

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
