import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HowItWorksScreen({ navigation }) {

  const onPrev = () => {
    // TODO: connect to carousel/video steps later
    console.log("Prev");
  };

  const onNext = () => {
    // TODO: connect to carousel/video steps later
    console.log("Next");
  };

  const onPlay = () => {
    // TODO: add video link
    console.log("Play");
  };


  // return (
  //   <SafeAreaView style={styles.safeArea}>
  //     <View style={styles.container}>
  //       <View style={styles.header}>
  //         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
  //           <Ionicons name="arrow-back" size={24} color="black" />
  //         </TouchableOpacity>
  //         <Text style={styles.headerTitle}>How It Works</Text>
  //         <View style={{ width: 24 }} />
  //       </View>
  //       <ScrollView contentContainerStyle={styles.content}>
  //         <Image
  //           source={require('../assets/everycirclelogonew_400x400.jpg')}
  //           style={styles.logo}
  //         />
  //         <Text style={styles.description}>
  //           Cesar to provide description of how EveryCicle works
  //         </Text>
  //       </ScrollView>
  //     </View>
  //   </SafeAreaView>
  // );
  //}



return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>

        <Text style={styles.topHeaderTitle}>HOME</Text>

        {/* spacer to keep HOME centered */}
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Tour / How it Works pill */}
        <View style={styles.tourPill}>
          <Text style={styles.tourText}>Tour </Text>
          <Text style={styles.tourHighlight}>How It Works</Text>
        </View>

        {/* Video/Slider Card */}
        <View style={styles.videoCard}>
          <View style={styles.videoInner}>
            <Image
              source={require("../assets/everycirclelogonew_400x400.jpg")}
              style={styles.videoImage}
            />

            <TouchableOpacity onPress={onPlay} style={styles.playBtn} activeOpacity={0.8}>
              <Ionicons name="play-circle" size={64} color="rgba(0,0,0,0.65)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.videoCaption}>
            The whole is greater than the sum of its parts ...
          </Text>

          <View style={styles.videoNavRow}>
            <TouchableOpacity onPress={onPrev} style={styles.navIconBtn}>
              <Ionicons name="chevron-back-circle-outline" size={30} color="#333" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onNext} style={styles.navIconBtn}>
              <Ionicons name="chevron-forward-circle-outline" size={30} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Small Logo Card */}
        <View style={styles.smallCard}>
          <Image
            source={require("../assets/everycirclelogonew_400x400.jpg")}
            style={styles.smallLogo}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.smallTitle}>everycircle.com</Text>
            <Text style={styles.smallSubtitle}>Connecting Circles of Influence</Text>
          </View>
        </View>

        {/* Big Text Card */}
        <View style={styles.bigCard}>
          <Text style={styles.bigTitle}>Got Business ?</Text>

          <Text style={styles.bigHeading}>One-Stop Marketing Platform</Text>
          <Text style={styles.bigItalic}>
            Comprehensive Turnkey Solution for{"\n"}
            Businesses, Organizations and Professionals{"\n"}
            solves common, fundamental challenges:
          </Text>

          <Text style={styles.bigBulletTitle}>Save Time, Money, ...</Text>
          <Text style={styles.bigBulletText}>Innovative, Results-Based Marketing System</Text>

          <Text style={styles.bigBulletTitle}>Generate Specific Connections</Text>
          <Text style={styles.bigBulletText}>
            Matching your criteria, geographical radius, ...
          </Text>

          <Text style={styles.bigBulletTitle}>Earn Multiple Revenue Streams</Text>
          <Text style={styles.bigBulletText}>
            with NO-COST Profiles for each{"\n"}
            individual, business, organization
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MAROON = "#4b0f14";
const CARD_BG = "#e9e5db";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },

  topHeader: {
    backgroundColor: MAROON,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 44,
    height: 30,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  topHeaderTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 30,
    alignItems: "center",
  },

  tourPill: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "#777",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  tourText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
  },
  tourHighlight: {
    fontSize: 20,
    fontStyle: "italic",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#e5d349", // yellow highlight
    color: "#111",
    fontWeight: "700",
  },

  videoCard: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "#777",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  videoInner: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 14,
    backgroundColor: "#f3f3f3",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  videoImage: {
    width: 160,
    height: 160,
    resizeMode: "contain",
    opacity: 0.95,
  },
  playBtn: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  videoCaption: {
    marginTop: 10,
    textAlign: "center",
    fontStyle: "italic",
    fontSize: 14,
    color: "#222",
  },
  videoNavRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navIconBtn: {
    padding: 2,
  },

  smallCard: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "#777",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  smallLogo: {
    width: 46,
    height: 46,
    borderRadius: 10,
    resizeMode: "contain",
    backgroundColor: "#fff",
  },
  smallTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  smallSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: "#222",
  },

  bigCard: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "#777",
    borderRadius: 18,
    padding: 14,
  },
  bigTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#3b0b10",
    marginBottom: 8,
  },
  bigHeading: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
    marginBottom: 6,
  },
  bigItalic: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#222",
    lineHeight: 20,
    marginBottom: 10,
  },
  bigBulletTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#3b0b10",
    marginTop: 8,
  },
  bigBulletText: {
    fontSize: 14,
    color: "#222",
    lineHeight: 20,
    marginTop: 2,
  },


  // container: {
  //   flex: 1,
  // },
  // header: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  //   paddingHorizontal: 15,
  //   paddingVertical: 10,
  //   borderBottomWidth: 1,
  //   borderBottomColor: '#eee',
  // },
  // backButton: {
  //   padding: 5,
  // },
  // headerTitle: {
  //   fontSize: 20,
  //   fontWeight: 'bold',
  // },
  // content: {
  //   flexGrow: 1,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   padding: 20,
  // },
  // logo: {
  //   width: 200,
  //   height: 200,
  //   resizeMode: 'contain',
  //   marginBottom: 30,
  // },
  // description: {
  //   fontSize: 18,
  //   textAlign: 'center',
  //   color: '#333',
  //   lineHeight: 26,
  // },
}); 