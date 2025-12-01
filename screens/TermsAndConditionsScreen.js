import React from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import BottomNavBar from "../components/BottomNavBar";
import AppHeader from "../components/AppHeader";
import { useDarkMode } from "../contexts/DarkModeContext";

export default function TermsAndConditionsScreen() {
  const navigation = useNavigation();
  const { darkMode } = useDarkMode();

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      <AppHeader
        title="Terms & Conditions"
        backgroundColor="#AF52DE"
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, darkMode && styles.darkTitle]}>Terms &amp; Conditions</Text>
        <Text style={[styles.body, darkMode && styles.darkBody]}>
          Updated: July 2024{"\n\n"}
          PLEASE REVIEW THE TERMS OF THIS AGREEMENT CAREFULLY. IF YOU DO NOT AGREE TO THIS AGREEMENT IN ITS ENTIRETY, YOU ARE NOT AUTHORIZED TO USE THE MANIFEST MY SPACE OFFERINGS IN ANY MANNER OR
          FORM.{"\n\n"}
          THIS AGREEMENT REQUIRES THE USE OF ARBITRATION ON AN INDIVIDUAL BASIS TO RESOLVE DISPUTES, RATHER THAN JURY TRIALS OR CLASS ACTIONS, AND ALSO LIMITS THE REMEDIES AVAILABLE TO YOU IN THE
          EVENT OF A DISPUTE.{"\n\n"}
          Welcome to Manifest My Space.{"\n\n"}These terms and conditions (this "Agreement") govern when you: {"\n"}(a) Access or use the Manifest My Space website or any other online Manifest My
          Space platform (collectively, the "Site"); {"\n"}(b) Access or use the Manifest My Space mobile application (the "App"); {"\n"}(c) Access and/or view any of the video, audio, stories, text,
          photographs, graphics, artwork and/or other content featured on the Site and/or in the App (collectively, "Content"); {"\n"}(d) Sign up to receive any products or services offered by
          Manifest My Space; {"\n"}(e) Access links to Manifest My Space's social media pages/accounts on third-party social media websites or mobile or other platforms, such as Facebook®, Instagram®,
          Pinterest®, LinkedIn®, Twitter®, Snapchat®, and YouTube® (collectively, "Social Media Pages"); {"\n"}(f) Enter one of the sweepstakes, contests and/or other promotions offered or conducted
          by Manifest My Space from time-to-time (collectively, "Promotions"); and/or {"\n"}(g) Utilize the many interactive features of the Site and/or App designed to facilitate interaction between
          you, Manifest My Space and other users of the Site and App, respectively, including, but not limited to, blogs and associated comment sections located in designated areas of the Site and
          App, as applicable (collectively, the "Interactive Services" and together with the Site, App, Content, Social Media Pages and Promotions, the "Manifest My Space Offerings"). {"\n\n"}By using
          the Manifest My Space Offerings, you acknowledge that you have read, understood, and agree to be legally bound by this Agreement and have read and understand our Privacy Policy. Further, you
          agree to enter into a legal binding agreement with Manifest My Space. {"\n"}Please do not access or use the Manifest My Space Offerings if you are unwilling or unable to be bound by this
          Agreement. The Manifest My Space Offerings are based and operated in the United States. We make no claims concerning whether the content may be downloaded, viewed, or be appropriate for use
          outside of the United States.{"\n"} If you access the Service or the Content from outside of the United States, you do so on your own initiative and at your own risk. Whether inside or
          outside of the United States, you are solely responsible for ensuring compliance with the laws of your specific jurisdiction.
          {"\n\n"}We may modify this Agreement from time to time at our sole discretion. {"\n"}When changes are made, we will notify you by making the revised version available on this webpage, and
          will indicate at the top of this page the date that revisions were last made.{"\n"}You should revisit this Agreement on a regular basis as revised versions will be binding on you.{"\n"}Any
          such modification will be effective upon our posting of new terms and conditions.{"\n"}You are responsible for staying informed of any changes and are expected to check this page from time
          to time so you are aware of any changes.{"\n"}You understand and agree that your continued access to or use of the Manifest My Space Offerings after any posted modification to this Agreement
          indicates your acceptance of the modifications. {"\n"}If you do not agree with the modified terms and conditions, you should stop using the Manifest My Space Offerings.
          {"\n\n"}Eligibility
          {"\n"}By using the Manifest My Space Offerings, you represent that you are at least eighteen (18) years of age (or the applicable age of majority if greater than eighteen (18) years of age
          in your jurisdiction), and have the requisite power and authority to enter into the Agreement and perform your obligations hereunder.
          {"\n\n"}Registration
          {"\n"}During the registration process, you will be asked to create an account and establish a password. Your account is for your personal, non-commercial use only. In creating it, we ask
          that you provide complete and accurate information. Please read our Privacy Policy on how this information will be used. You are responsible for maintaining the confidentiality of your
          account password and you are responsible for all activities that occur in connection with your account made by you or anyone you allow to use your account. You agree to safeguard your
          account password from access by others. You agree to indemnify and hold harmless Manifest My Space for losses incurred by Manifest My Space or another party due to someone else using your
          account or password. Manifest My Space has the right to disable any user name, password or other identifier, whether chosen by you or provided by Manifest My Space, at any time, in its sole
          discretion for any or no reason, if, in our opinion, you have violated any provisions of this Agreement.
          {"\n\n"}Manifest My Space reserves the right to withdraw or amend the Manifest My Space Offerings, and any service or material we provide on the Site, the App or Social Media Pages, in its
          sole discretion without notice. Manifest My Space will not be liable if for any reason all or any part of the Site is unavailable at any time or for any period. From time to time, Manifest
          My Space may restrict access to some parts of the Manifest My Space Service, or the entire Manifest My Space Service, to users, including registered users.
          {"\n\n"}Manifest My Space Billing
          {"\n"}When you first sign up for a subscription to a Manifest My Space Plan (a "Plan"), you are charged for the entire delivery period of your Plan selection. All Plans are continuous
          subscription plans, and you will be charged the applicable price listed for the Plan that you select after your current subscription is fulfilled. If you wish to cancel or modify your
          subscription to a Plan, you can do so at any time as described in the "Cancel or Modify a Subscription" section below; however, except as otherwise noted below, any amounts charged to or
          paid by you prior to such cancellation or modification will not be refunded, and cancellations or modifications may not impact any order for which you have already been charged, depending on
          the status of the order.
          {"\n\n"}Manifest My Space may change the price of a Plan, introduce new Plans, or remove Plans from time to time, and will communicate any price or Plan changes to you in advance in
          accordance with the "Notice" section of this Agreement. Price and Plan changes will take effect as of the next billing period following the date on which Manifest My Space provided notice to
          you of the price or Plan change. By continuing to use the Manifest My Space Service after the effective date of a price or Plan change, you indicate your acceptance of such price or Plan
          change. If you do not agree with a price or Plan change, you have the right to reject the change by cancelling your subscription(s) prior to the effective date of the price or Plan change.
          Please make sure that you read any notifications of price or Plan changes carefully.
          {"\n\n"}Applicable sales tax may be charged on your order based on local and state laws.
          {"\n\n"}You are fully responsible for all activities that occur under your account, and you agree to be personally liable for all charges incurred under your account based on your delivery
          status as of the specified deadline. Your liability for such charges shall continue after termination of this Agreement.
          {"\n\n"}WHEN YOU REGISTER FOR THE MANIFEST MY SPACE SUBSCRIPTION SERVICE (AND EACH TIME YOU CHANGE YOUR PLAN) YOU EXPRESSLY AUTHORIZE AND AGREE THAT MANIFEST MY SPACE AND/OR OUR THIRD PARTY
          PAYMENT PROCESSOR IS AUTHORIZED TO AUTOMATICALLY CHARGE YOUR PAYMENT METHOD (AS DEFINED BELOW) ON A RECURRING BASIS IN AN AMOUNT EQUAL TO THE THEN-EFFECTIVE RATE FOR YOUR PLAN, TOGETHER WITH
          ANY APPLICABLE TAXES AND SHIPPING (the "PLAN RATE"), FOR AS LONG AS YOU CONTINUE TO USE THE MANIFEST MY SPACE SUBSCRIPTION SERVICE, UNLESS YOU CANCEL YOUR MANIFEST MY SPACE SUBSCRIPTION
          SERVICE IN ACCORDANCE WITH THIS AGREEMENT. YOU ACKNOWLEDGE AND AGREE THAT MANIFEST MY SPACE WILL NOT OBTAIN ANY ADDITIONAL AUTHORIZATION FROM YOU FOR SUCH AUTOMATIC, RECURRING PAYMENTS. IN
          ADDITION, YOU AUTHORIZE US (AND/OR OUR THIRD PARTY PAYMENT PROCESSOR) TO CHARGE YOUR PAYMENT METHOD FOR ANY ADDITIONAL MANIFEST MY SPACE OFFERINGS PURCHASED BY YOU FROM TIME TO TIME OUTSIDE
          OF OR IN EXCESS OF YOUR PLAN, PLUS ANY APPLICABLE TAXES AND SHIPPING. EVERY TIME THAT YOU USE THE MANIFEST MY SPACE SUBSCRIPTION SERVICE, YOU RE-AFFIRM THAT MANIFEST MY SPACE IS AUTHORIZED
          TO CHARGE YOUR PAYMENT METHOD AS PROVIDED IN THE AGREEMENT, AND TO HAVE ALL APPLICABLE FEES AND CHARGES APPLIED TO SAME.
          {"\n\n"}Cancel or Modify a Subscription
          {"\n"}Following your Plan selection, order placement and receipt of your first weekly order, you may cancel or modify a subscription to a Plan at any time online by managing your account at
          Manifest My Space or via the App, or by emailing us at support@mealsfor.me.
          {"\n\n"}To avoid being charged for placed orders that you no longer wish to receive in the event of a subscription cancellation, you must cancel prior to the date when you are to be charged
          for your next order, which is emailed to you after your receive the last delivery of your current Plan and also displayed on the Subscriptions and Order History pages. The charge is
          typically 1 or 2 days before your next expected delivery, depending on your specified deadline, but can vary depending on shipping length and other factors.
          {"\n\n"}If you cancel a subscription to a Plan before receiving your first order, your first order may or may not be cancelled and related amounts paid may or may not be refunded to you,
          depending on factors including the status of your meals in our production process, and any promotions applied. You will be notified at the time of cancellation if any of your charged orders
          will be cancelled and refunded, To confirm, email us at support@mealsfor.me.
          {"\n\n"}Shipping
          {"\n"}We use third-party carriers (e.g. Just Delivered) to deliver your food packages and provide you with tracking information for every package. It is very important that you provide us
          with the proper shipping information and any special instructions that the delivery driver may need.
          {"\n\n"}App
          {"\n"}You shall be responsible, at all times, for ensuring that you have an applicable mobile device and/or other equipment and service necessary to access the App. Manifest My Space does
          not guarantee the quality, speed or availability of the Internet connection associated with your mobile device. Manifest My Space does not guarantee that the App can be accessed: {"\n"}(a)
          on all mobile devices; {"\n"}(b) through all wireless service plans; and/or {"\n"}(c) in all geographical areas. Standard messaging, data and wireless access fees may apply to your use of
          the App. You are fully responsible for all such charges and Manifest My Space has no liability or responsibility to you, whatsoever, for any such charges billed by your wireless carrier.
          {"\n\n"}Export/Usage Restrictions. {"\n"}You agree that the App may not be transferred or exported into any other country, or used in any manner prohibited by U.S. or other applicable export
          laws and regulations. The Manifest My Space Offerings are subject to, and you agree that you shall at all times comply with, all local, state, national and international laws, statutes,
          rules, regulations, ordinances and the like applicable to use of the Manifest My Space Offerings. You agree not to use the Manifest My Space Offerings: {"\n"}(a) for any commercial purposes;
          or {"\n"}(b) to conduct any business or activity, or solicit the performance of any activity, which is prohibited by law or any contractual provision by which you are bound.
          {"\n\n"}Content
          {"\n"}The Site and App contain Content which includes, but is not limited to, information pertaining to the Manifest My Space Offerings, as well as regularly updated blog posts and third
          party links. The Content is offered for informational purposes only and is at all times subject to the disclaimers contained herein, and on the Site and in the App.
          {"\n\n"}Interactive Services
          {"\n"}Subject to the restrictions set forth herein, the Interactive Services will allow users to participate in comment sections and other interactive areas of the Site and/or App. Each user
          agrees to use the Interactive Services in full compliance with all applicable laws and regulations. Each user shall be solely responsible for her/his comments, opinions, statements, feedback
          and other content (collectively, "Feedback") posted by and through the Interactive Services. You understand and agree that Manifest My Space shall not be liable to you, any other user or any
          third party for any claim in connection with your use of, or inability to use, the Interactive Services. Manifest My Space does not monitor the Feedback submitted by users, and operates the
          comment sections of the Site and App as a neutral host. The Interactive Services contain Feedback that is provided directly by users. You agree that Manifest My Space shall have no
          obligation and incur no liability to you in connection with any Feedback appearing in or through the Interactive Services. Manifest My Space does not represent or warrant that the Feedback
          posted through the Interactive Services is accurate, complete or appropriate. Manifest My Space reserves the right to remove any Feedback from the Site and/or App at any time and for any
          reason, in Manifest My Space's sole discretion.
          {"\n\n"}
          You agree to use the Interactive Services in a manner consistent with any and all applicable laws and regulations. In connection with your use of the Interactive Services and other of the
          Manifest My Space Offerings, you agree not to: {"\n"}
          (a) display any telephone numbers, street addresses, last names, URLs, e-mail addresses or any confidential information of any third party; {"\n"}
          (b) display any audio files, text, photographs, videos or other images containing confidential information; {"\n"}
          (c) display any audio files, text, photographs, videos or other images that may be deemed indecent or obscene in your community, as defined under applicable law; {"\n"}
          (d) impersonate any person or entity; {"\n"}
          (e) "stalk" or otherwise harass any person; {"\n"}
          (f) engage in unauthorized advertising to, or commercial solicitation of, other users; {"\n"}
          (g) transmit any chain letters, spam or junk e-mail to other users; {"\n"}
          (h) express or imply that any statements that you make are endorsed by Manifest My Space, without Manifest My Space's specific prior written consent; {"\n"}
          (i) harvest or collect personal information of other users whether or not for commercial purposes, without their express consent; {"\n"}
          (j) use any robot, spider, search/retrieval application or other manual or automatic device or process to retrieve, index, "data mine" or in any way reproduce or circumvent the navigational
          structure or presentation of the App, Site and/or their respective content; {"\n"}
          (k) post, distribute or reproduce in any way any copyrighted material, trademarks or other proprietary information without obtaining the prior consent of the owner of such proprietary
          rights; {"\n"}
          (l) remove any copyright, trademark or other proprietary rights notices contained in the App and/or Site; {"\n"}
          (m) interfere with or disrupt the App, Site and/or the servers or networks connected to same; {"\n"}
          (n) post, offer for download, e-mail or otherwise transmit any material that contains software viruses or any other computer code, files or programs designed to interrupt, destroy or limit
          the functionality of any computer software or hardware or telecommunications equipment; {"\n"}
          (o) post, offer for download, transmit, promote or otherwise make available any software, product or service that is illegal or that violates the rights of a third party including, but not
          limited to, spyware, adware, programs designed to send unsolicited advertisements (i.e. "spamware"), services that send unsolicited advertisements, programs designed to initiate "denial of
          service" attacks, mail bomb programs and programs designed to gain unauthorized access to mobile networks; {"\n"}
          (p) "frame" or "mirror" any part of the App and/or Site without Manifest My Space's prior written authorization; {"\n"}
          (q) use metatags or code or other devices containing any reference to any Manifest My Space Offerings in order to direct any person to any other mobile application or website for any
          purpose; and/or {"\n"}
          (r) modify, adapt, sublicense, translate, sell, reverse engineer, decipher, decompile or otherwise disassemble any portion of the Manifest My Space Offerings or any software used in or in
          connection with Manifest My Space Offerings. Engaging in any of the aforementioned prohibited practices shall be deemed a breach of the Agreement and may result in the immediate termination
          of your access to the App and/or Site without notice, in the sole discretion of Manifest My Space. Manifest My Space reserves the right to pursue any and all legal remedies against users
          that engage in the aforementioned prohibited conduct.
          {"\n\n"}
          By submitting or posting content to the Interactive Services, you grant Manifest My Space, its directors, officers, affiliates, subsidiaries, assigns, agents, and licensees the irrevocable,
          perpetual, worldwide right to reproduce, display, perform, distribute, adapt, and promote any posted content in any medium. Once you submit or post content to the Interactive Services,
          Manifest My Space will not give you any right to inspect or approve uses of such content or to compensate you for any such uses. Manifest My Space owns all right, title, and interest in any
          compilation, collective work or other derivative work, whether or not created by Manifest My Space, using or incorporating content posted to the Interactive Services. For more information,
          please review Manifest My Space's Privacy Policy.
          {"\n\n"}
          You are solely responsible for anything you may post on the Interactive Services. Manifest My Space will not be responsible, or liable to any third party, for the content or accuracy of any
          content posted by you or any other user of the Interactive Services.
          {"\n\n"}
          Manifest My Space is not responsible for, and does not endorse, content in any posting made by other users on the Interactive Services. You are solely responsible for your reliance on
          anything posted by another user on the Interactive Services. Under no circumstances will Manifest My Space be held liable, directly or indirectly, for any loss or damage caused or alleged to
          have been caused to you or any third party in connection with the use of or reliance of any content posted by a third party on the Interactive Services. If you become aware of any misuse of
          the Sites by any person, please contact Manifest My Space at support@mealsfor.me.
          {"\n\n"}
          If you feel threatened or believe someone else is in danger, you should contact your local law enforcement agency immediately. Manifest My Space has the right to remove any user
          contributions from the Interactive Services for any or no reason. Manifest My Space reserves the right to take necessary legal action against users.
          {"\n\n"}
          Manifest My Space may disclose user information including personal identity and other personal information to any third party who claims that material posted by you violates their rights,
          including their intellectual property rights or their right to privacy. Manifest My Space has the right to cooperate with any law enforcement authorities or court order requesting or
          directing Manifest My Space to disclose the identity or other information of anyone posting any materials on or through the Interactive Services.
          {"\n\n"}
          YOU WAIVE AND HOLD MANIFEST MY SPACE HARMLESS FROM ANY CLAIMS RESULTING FROM ANY ACTION TAKEN BY MANIFEST MY SPACE, DURING OR AS A RESULT OF ITS INVESTIGATIONS, AND FROM ANY ACTIONS TAKEN AS
          A CONSEQUENCE OF INVESTIGATIONS BY MANIFEST MY SPACE, LAW ENFORCEMENT AUTHORITIES OR OTHER THIRD PARTIES.
          {"\n\n"}
          Manifest My Space does not undertake to review any materials before you have posted them on the Interactive Services and cannot ensure prompt removal of objectionable material after it has
          been posted. Manifest My Space assumes no liability for any action or inaction regarding transmissions, communications or content provided by any user or third party. Manifest My Space shall
          have no liability or responsibility to anyone for performance or nonperformance of the activities described in this section.
          {"\n\n"}
          Manifest My Space has the right to terminate your account and your access to the Interactive Services for any reason, including, without limitation, if Manifest My Space, in its sole
          discretion, considers your use to be unacceptable. Manifest My Space may, but shall not be under any obligation to, provide you a warning prior to termination of your use of the Interactive
          Services.
          {"\n\n"}
          Manifest My Space Intellectual Property{"\n"}
          The Site, App, and all associated Content, design, text, graphics, and interfaces; as well the collection, selection, and arrangement thereof; and all associated software (collectively, the
          "Manifest My Space Materials"), are the sole and exclusive property of, or duly licensed to, Manifest My Space. The Manifest My Space Materials are copyrighted as a collective work under the
          laws of the United States and other copyright laws. Manifest My Space holds the copyright in the collective work. The collective work includes works which may be property of other members.
          You may display and, subject to any expressly stated restrictions or limitations relating to specific material, download portions of the material from the different areas of the Site and/or
          App solely for your own non-commercial use, unless otherwise permitted (e.g., in the case of electronic coupons, etc.). Any redistribution, retransmission or publication of any copyrighted
          material is strictly prohibited without the express written consent of the copyright owner. You agree not to change or delete any proprietary notices from materials downloaded from the Site
          and/or the App.
          {"\n\n"}
          The Manifest My Space Materials (including but not limited to all information, software, text, displays, images, video and audio, and the design, selection and arrangement thereof), are
          owned by Manifest My Space or its affiliates, its licensors or other providers of such material and are protected by United States and international copyright, trademark, patent, trade
          secret and other intellectual property or proprietary rights laws.
          {"\n\n"}
          This Agreement permits you access to the Site and/or the App for your personal, non-commercial use only. You must not reproduce, distribute, modify, create derivative works from, publicly
          display, publicly perform, republish, download, store or transmit any of the material on our Site and/or the App.
          {"\n\n"}
          You must not {"\n"}(i) modify copies of any materials from the Site; {"\n"}(ii) use any illustrations, photographs, video or audio sequences or any graphics separately from the accompanying
          text, and {"\n"}(iii) delete or alter any copyright, trademark or other proprietary rights notices from copies of materials from the Site and/or the App. {"\n"}You must not access or use for
          any commercial purposes any part of the Site and/or the App or any services or materials available through the Site and/or the App.
          {"\n\n"}
          If you print, copy, modify, download or otherwise use or provide any other person with access to any part of the Site and/or the App in breach of this Agreement, your right to use the Site
          and/or the App will cease immediately and you must, at our option, return or destroy any copies of the materials you have made. No right, title or interest in or to the Site and/or the App
          or any content on the Site and/or the App is transferred to you, and all rights not expressly granted are reserved by Manifest My Space. Any use of the Site and/or the App not expressly
          permitted by this Agreement is a breach of this Agreement and may violate copyright, trademark and other laws.
          {"\n\n"}
          Trademarks{"\n"}
          The Manifest My Space name, logo and all related names, logos, product and service names, designs and slogans are trademarks of Infinite Options LLC. or its affiliates or licensors. You must
          not use such marks without the prior written permission of Manifest My Space. All other names, logos, product and service names, designs and slogans on the Site and/or the App are the
          trademarks of their respective owners.
          {"\n\n"}
          Facebook® and Instagram® are registered trademarks of Facebook, Inc. ("Facebook"). LinkedIn® is a registered trademark of LinkedIn Corporation ("LinkedIn"). Pinterest® is a registered
          trademark of Pinterest, Inc. ("Pinterest"). Twitter® is a registered trademark of Twitter, Inc. ("Twitter"). Snapchat® is a registered trademark of Snapchat, Inc. YouTube® is a registered
          trademark of Google, Inc. ("Google"). Please be advised that Manifest My Space is not in any way affiliated with Facebook, Google, LinkedIn, Pinterest or Twitter, and the Manifest My Space
          Offerings are not endorsed, administered or sponsored by any of those parties.
          {"\n\n"}
          Policy/DMCA Compliance{"\n"}
          If you believe any materials accessible on or from the Site and/or the APP infringe your copyright, you may request removal of those materials (or access thereto) from the Site and/or the
          App by contacting Manifest My Space (as set forth below) and providing the following information:
          {"\n\n"}
          Identification of the copyrighted work that you believe to be infringed. Please describe the work and, where possible, include a copy or the location (e.g., URL) of an authorized version of
          the work.
          {"\n\n"}
          Identification of the material that you believe to be infringing and its location. Please describe the material, and provide us with its URL or any other pertinent information that will
          allow us to locate the material.
          {"\n\n"}
          Your name, address, telephone number, and e-mail address.
          {"\n\n"}A statement that you have a good faith belief that the complained use of the materials is not authorized by the copyright owner, its agent, or the law.
          {"\n\n"}A statement that the information that you have supplied is accurate, and indicating that "under penalty of perjury", you are the copyright owner or are authorized to act on the
          copyright owner's behalf.
          {"\n\n"}A signature or the electronic equivalent from the copyright holder or authorized representative.
          {"\n\n"}
          Send this information by mail to Manifest My Space, 6123 Corte de la Reina, San Jose, CA 95120, ATTN: Legal Department. In an effort to protect the rights of copyright owners, Manifest My
          Space maintains a policy for the termination, in appropriate circumstances, of subscribers and account holders of the Site who are repeat infringers.
          {"\n\n"}
          Changes to the Site{"\n"}
          Manifest My Space may update the content on the Site/and or the App from time to time, but its content is not necessarily complete or up-to-date. Any of the material on the Site may be out
          of date at any given time, and Manifest My Space is under no obligation to update such material.
          {"\n\n"}
          Information About You and Your Visits to the Site and/or the APP{"\n"}
          All information we collect on this Site and/or the App is subject to our Privacy Policy. By using the Site and/or the App, you consent to all actions taken by Manifest My Space with respect
          to your information in compliance with the Privacy Policy.
          {"\n\n"}
          Online Purchases and Other Terms and Conditions All purchases through this Site and/or the App or other transactions for the sale of goods or services or information formed through the Site
          and/or the App or as a result of visits made by you are governed by this Agreement.
          {"\n\n"}
          Additional terms and conditions may also apply to specific portions, services or features of the Site and/or the App. All such additional terms and conditions are hereby incorporated by this
          reference into this Agreement.
          {"\n\n"}
          Links from the Site and/or the App{"\n"}
          If the Site and/or the App contains links to other sites and resources provided by third parties, these links are provided for your convenience only. This includes links contained in
          advertisements, including banner advertisements and sponsored links. Manifest My Space has no control over the contents of those sites or resources, and accepts no responsibility for them or
          for any loss or damage that may arise from your use of them. If you decide to access any of the third-party websites linked to this Site and/or the App, you do so entirely at your own risk
          and subject to the terms and conditions of use for such websites.
          {"\n\n"}
          The Site and/or the App may include content provided by third parties, including materials provided by other users, bloggers and third-party licensors, syndicators, aggregators and/or
          reporting services. All statements and/or opinions expressed in these materials, and all articles and responses to questions and other content, other than the content provided by Manifest My
          Space, are solely the opinions and the responsibility of the person or entity providing those materials. These materials do not necessarily reflect the opinion of Manifest My Space. Manifest
          My Space is not responsible, or liable to you or any third party, for the content or accuracy of any materials provided by any third parties.
          {"\n\n"}
          Warranties{"\n"}
          THE MANIFEST MY SPACE OFFERINGS AND/OR ANY OTHER CONTENT, INFORMATION, PRODUCTS AND/OR SERVICES OFFERED BY AND THROUGH SAME ARE PROVIDED TO YOU ON AN "AS IS" AND "AS AVAILABLE" BASIS AND ALL
          WARRANTIES, EXPRESS AND IMPLIED STATUTORY OR OTHERWISE, ARE DISCLAIMED TO THE FULLEST EXTENT PERMISSIBLE PURSUANT TO APPLICABLE LAW (INCLUDING, BUT NOT LIMITED TO, THE DISCLAIMER OF ANY
          WARRANTIES OF MERCHANTABILITY, NON-INFRINGEMENT OF THIRD PARTIES' RIGHTS, AND FITNESS FOR PARTICULAR PURPOSE). IN PARTICULAR, BUT NOT AS A LIMITATION THEREOF, MANIFEST MY SPACE MAKES NO
          WARRANTY THAT THE MANIFEST MY SPACE OFFERINGS AND/OR ANY OTHER CONTENT, INFORMATION, PRODUCTS AND/OR SERVICES OFFERED BY AND THROUGH SAME: {"\n"}(A) WILL MEET YOUR REQUIREMENTS; {"\n"}(B)
          WILL BE UNINTERRUPTED, TIMELY, SECURE OR ERROR-FREE OR THAT DEFECTS WILL BE CORRECTED; {"\n"}(C) WILL BE FREE OF HARMFUL COMPONENTS; {"\n"}(D) WILL RESULT IN ANY SPECIFIC DIETARY BENEFIT,
          WEIGHT LOSS OR OTHER HEALTH-RELATED OUTCOME; AND/OR {"\n"}(E) WILL BE ACCURATE OR RELIABLE. {"\n\n"}THE MANIFEST MY SPACE OFFERINGS AND/OR ANY OTHER CONTENT, INFORMATION, PRODUCTS AND/OR
          SERVICES OFFERED BY AND THROUGH SAME MAY CONTAIN BUGS, ERRORS, PROBLEMS OR OTHER LIMITATIONS. MANIFEST MY SPACE WILL NOT BE LIABLE FOR THE AVAILABILITY OF THE UNDERLYING INTERNET AND/OR
          MOBILE NETWORK CONNECTION ASSOCIATED WITH THE MANIFEST MY SPACE OFFERINGS. NO ADVICE OR INFORMATION, WHETHER ORAL OR WRITTEN, OBTAINED BY YOU FROM MANIFEST MY SPACE OR OTHERWISE THROUGH OR
          FROM THE MANIFEST MY SPACE OFFERINGS SHALL CREATE ANY WARRANTY NOT EXPRESSLY STATED IN THE AGREEMENT. WITHOUT LIMITING THE FOREGOING, MANIFEST MY SPACE DOES NOT ENDORSE USER CONTENT OR
          FEEDBACK AND SPECIFICALLY DISCLAIMS ANY RESPONSIBILITY OR LIABILITY TO ANY PERSON OR ENTITY FOR ANY LOSS, DAMAGE (WHETHER ACTUAL, CONSEQUENTIAL, PUNITIVE OR OTHERWISE), INJURY, CLAIM,
          LIABILITY OR OTHER CAUSE OF ANY KIND OR CHARACTER BASED UPON OR RESULTING FROM ANY FEEDBACK.
          {"\n\n"}
          Manifest My Space makes no warranty as to the reliability, accuracy, timeliness, usefulness, adequacy, completeness or suitability of the Site and/or the App. Manifest My Space cannot and
          does not warrant against human and machine errors, omissions, delays, interruptions or losses, including loss of data. Manifest My Space cannot and does not guarantee or warrant that files
          available for downloading from the Site and/or the App will be free of infection by viruses, worms, Trojan horses, or other codes that manifest contaminating or destructive properties.
          Manifest My Space cannot and does not guarantee or warrant that any content you post on the Site and/or the App will remain on the Site and/or the App. Manifest My Space does not warrant or
          guarantee that the functions or services performed on the Site and/or the App will be uninterrupted or error-free or that defects in the Site and/or the App will be corrected.
          {"\n\n"}
          Manifest My Space may disable all or any social media features and any links at any time without notice at our discretion.
          {"\n\n"}
          Limitation of Liability{"\n"}
          YOU EXPRESSLY UNDERSTAND AND AGREE THAT NEITHER MANIFEST MY SPACE IS TO DISCONTINUE YOUR USE OF THE SITE. MANIFEST MY SPACE, NOR ANY OF ITS DIRECTORS, OFFICERS, EMPLOYEES, SHAREHOLDERS,
          AFFILIATES, AGENTS, REPRESENTATIVES, THIRD-PARTY INFORMATION PROVIDERS, MERCHANTS, OR LICENSORS (COLLECTIVELY,"MANIFEST MY SPACE PARTIES") SHALL BE LIABLE TO YOU OR THIRD PARTY FOR ANY
          DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL AND/OR EXEMPLARY DAMAGES INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA OR OTHER INTANGIBLE LOSSES, (EVEN
          IF MANIFEST MY SPACE OR THE APPLICABLE MANIFEST MY SPACE PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES), TO THE FULLEST EXTENT PERMISSIBLE BY LAW FOR: {"\n"}
          (A) THE USE OR THE INABILITY TO USE THE MANIFEST MY SPACE OFFERINGS AND/OR ANY OTHER CONTENT, INFORMATION, PRODUCTS AND/OR SERVICES OFFERED BY AND THROUGH SAME; {"\n"}
          (B) THE COST OF PROCUREMENT OF SUBSTITUTE GOODS AND SERVICES RESULTING FROM ANY GOODS, DATA, INFORMATION, CONTENT AND/OR ANY OTHER PRODUCTS PURCHASED OR OBTAINED FROM OR THROUGH THE MANIFEST
          MY SPACE OFFERINGS; {"\n"}(C) THE UNAUTHORIZED ACCESS TO, OR ALTERATION OF, YOUR ACCOUNT INFORMATION; {"\n"}(D) THE FAILURE TO REALIZE ANY SPECIFIC DIETARY BENEFIT, WEIGHT LOSS OR OTHER
          HEALTH-RELATED OUTCOME; AND/OR {"\n"}(E) ANY OTHER MATTER RELATING TO THE MANIFEST MY SPACE OFFERINGS AND/OR ANY OTHER CONTENT, INFORMATION, PRODUCTS AND/OR SERVICES OFFERED BY AND/OR
          THROUGH SAME. {"\n"}THIS LIMITATION APPLIES TO ALL CAUSES OF ACTION, IN THE AGGREGATE INCLUDING, BUT NOT LIMITED TO, BREACH OF CONTRACT, BREACH OF WARRANTY, NEGLIGENCE, STRICT LIABILITY,
          MISREPRESENTATION AND ANY AND ALL OTHER TORTS. YOU HEREBY RELEASE MANIFEST MY SPACE AND THE MANIFEST MY SPACE PARTIES FROM ANY AND ALL OBLIGATIONS, LIABILITIES AND CLAIMS IN EXCESS OF THE
          LIMITATIONS STATED HEREIN. {"\n"}IF APPLICABLE LAW DOES NOT PERMIT SUCH LIMITATIONS, THE MAXIMUM LIABILITY OF MANIFEST MY SPACE TO YOU UNDER ANY AND ALL CIRCUMSTANCES WILL BE AS SET FORTH IN
          THE DISPUTE RESOLUTION PROVISIONS OF THESE TERMS AND CONDITIONS. NO ACTION, REGARDLESS OF FORM, ARISING OUT OF YOUR USE OF THE MANIFEST MY SPACE OFFERINGS AND/OR ANY OTHER PRODUCTS AND/OR
          SERVICES OFFERED BY AND/OR THROUGH SAME, MAY BE BROUGHT BY YOU OR MANIFEST MY SPACE MORE THAN ONE (1) YEAR FOLLOWING THE EVENT WHICH GAVE RISE TO THE SUBJECT CAUSE OF ACTION. THE NEGATION OF
          DAMAGES SET FORTH ABOVE IS A FUNDAMENTAL ELEMENT OF THE BASIS OF THE BARGAIN BETWEEN YOU AND MANIFEST MY SPACE. ACCESS TO THE MANIFEST MY SPACE OFFERINGS AND/OR ANY OTHER CONTENT,
          INFORMATION, PRODUCTS AND/OR SERVICES OFFERED BY AND/OR THROUGH SAME WOULD NOT BE PROVIDED TO YOU WITHOUT SUCH LIMITATIONS. BECAUSE SOME STATES OR JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR
          THE LIMITATION OF LIABILITY FOR CONSEQUENTIAL OR INCIDENTAL DAMAGES, IN SUCH STATES OR JURISDICTIONS, MANIFEST MY SPACE'S AND 'THE MANIFEST MY SPACE PARTIES' LIABILITY SHALL BE LIMITED TO
          THE EXTENT PERMITTED BY LAW.
          {"\n\n"}
          Indemnification{"\n"}
          You agree to indemnify, defend, and hold Manifest My Space, its officers, directors, employees, shareholders, affiliates agents, licensors, and suppliers, harmless from and against any
          claims, actions or demands, liabilities and settlements including without limitation, reasonable legal and accounting fees, resulting from, or alleged to result from, your violation of this
          Agreement or your use of the Manifest My Space Offerings or your use of any information obtained from the Manifest My Space Offerings.
          {"\n\n"}
          Governing Law and Jurisdiction{"\n"}
          This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws rules.
          {"\n\n"}
          Resolving Disputes — Arbitration
          {"\n"}Most customer concerns can be resolved quickly and to the customer's satisfaction BY calling our customer service department at 1-925-400-7469. IF Manifest My Space's customer service
          department is unable to resolve a complaint you may have to your satisfaction (or if Manifest My Space has not been able to resolve a dispute it has with you after attempting to do so
          informally), we each agree to resolve those disputes through binding arbitration or small claims court instead of in courts of general jurisdiction.
          {"\n\n"}All disputes or claims that arise under or related to this Agreement (whether in contract, tort or otherwise, whether past, pre-existing, or future, and including statutory, consumer
          protection, common law, intentional tort, injunctive, and equitable claims) will be resolved either in small claims court or by individual arbitration in accordance with the rules of the
          American Arbitration Association ("AAA"). Unless you and Manifest My Space agree otherwise, any arbitration hearings will take place in the county (or parish) of your billing address. The
          AAA Rules are available online at adr.org, by calling the AAA at 1-800-778-7879. Manifest My Space agrees that it will pay a consumer's filing fee FOR the arbitration.
          {"\n\n"}You agree to arbitration on an individual basis. In any dispute, NEITHER CUSTOMER NOR MANIFEST MY SPACE SHALL BE ENTITLED TO JOIN OR CONSOLIDATE CLAIMS BY OR AGAINST OTHER CUSTOMERS,
          OR ARBITRATE OR OTHERWISE PARTICIPATE IN ANY CLAIMS AS A REPRESENTATIVE, CLASS MEMBER, OR IN A PRIVATE ATTORNEY GENERAL CAPACITY. If any provision of this arbitration agreement is found
          unenforceable, the unenforceable provision shall be severed, and the remaining arbitration terms shall be enforced (but in no case shall there be a class arbitration).
          {"\n\n"}The arbitrator shall be empowered to grant whatever relief would be available in court under law. Any award of the arbitrator shall be final and binding on each of the parties, and
          may be entered as a judgment in any court of competent jurisdiction. This transaction and the arbitration shall be governed by the Federal Arbitration Act 9 U.S.C. sec. 1-16 (FAA).
          {"\n\n"}Waiver and Severability
          {"\n"}No waiver by Manifest My Space of any of the terms and conditions set forth in this Agreement shall be deemed a further or continuing waiver of such term or condition or a waiver of
          any other term or condition, and any failure of Manifest My Space to assert a right or provision under these Terms and Conditions shall not constitute a waiver of such right or provision.
          {"\n\n"}If any provision of this Agreement is held by a court or other tribunal of competent jurisdiction to be invalid, illegal or unenforceable for any reason, such provision shall be
          eliminated or limited to the minimum extent such that the remaining provisions of this Agreement will continue in full force and effect.
          {"\n\n"}Entire Agreement
          {"\n"}This Agreement and our Privacy Policy constitute the sole and entire agreement between you and Manifest My Space with respect to the Manifest My Space Offerings and supersede all prior
          and contemporaneous understandings, agreements, representations and warranties, both written and oral, with respect to the Manifest My Space Offerings.
          {"\n\n"}Notice
          {"\n"}Manifest My Space may deliver notice to you under this Agreement by means of electronic mail, a general notice on the site, or by written communication delivered by first class U.S.
          mail to your address on record in your Manifest My Space account. You may give notice to Manifest My Space at any time via electronic mail or by letter delivered by first class postage
          prepaid U.S. mail or overnight courier to the following address: Manifest My Space, 6123 Corte de la Reina, San Jose CA 95120, Attn: Legal Department.
          {"\n\n"}Telephone Calls and SMS Text Messages
          {"\n"}Upon registration for an account, you will be asked to provide us with a telephone number at which we can reach you. That number is required for shipping and so that Manifest My Space
          can reach you with informational calls related to your transactions. The frequency of text messages that we send to you depends on your transactions with us and you consent to receive text
          messages sent through an automatic telephone dialing system. All calls to and from Manifest My Space may be monitored or recorded for quality and training purposes.
          {"\n\n"}If you elect to receive text messages about your account, we may also send you promotional text messages and you consent to receive recurring SMS text messages sent through an
          automatic telephone dialing system. This service is optional, and is not a condition of purchase. You can opt out of receiving SMS messages at any time by texting STOP in response. Message
          and data rates may apply. We will treat data collected through text messages in accordance with our Privacy Policy.
          {"\n\n"}All charges are billed by and payable to your wireless service provider. Please contact your wireless service provider for pricing plans and details. If you wish to opt out of such
          text messages, you may do so by following the "opt-out" instructions in the text message, or by editing your account settings. Message and data rates may apply. We will treat data collected
          through text messages in accordance with our Privacy Policy.
        </Text>

        {/* Close button at bottom */}
        <TouchableOpacity style={[styles.closeButton, darkMode && styles.darkCloseButton]} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>

        {/* Bottom buffer space to ensure Close button is visible above BottomNavBar */}
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
  },
  darkBody: {
    color: "#cccccc",
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
    height: 100, // Provides space above BottomNavBar
    marginBottom: 20,
  },
});
