/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import type { Node } from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

const Section = ({ children, title }): Node => {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: isDarkMode ? Colors.light : Colors.dark,
          },
        ]}>
        {children}
      </Text>
    </View>
  );
};

const App: () => Node = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        {/* <Header /> */}
        <View
          style={{
            backgroundColor: isDarkMode ? Colors.black : Colors.white,
          }}>
          <Section title="Step One">
            <Button
              onPress={() => {
                // Alert.alert('thanks')
                getPhotos()
              }}
              title="Press me"
            >
              Press me
            </Button>
            {/* Edit <Text style={styles.highlight}>App.js</Text> to change this
            screen and then come back to see your edits. */}
          </Section>
          {/* <Section title="See Your Changes">
            <ReloadInstructions />
          </Section>
          <Section title="Debug">
            <DebugInstructions />
          </Section>
          <Section title="Learn More">
            Read the docs to discover what to do next:
          </Section> */}
          {/* <LearnMoreLinks /> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;




import { PermissionsAndroid, Platform } from "react-native";
import CameraRoll from "@react-native-community/cameraroll";

async function hasAndroidPermission() {
  const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;

  const hasPermission = await PermissionsAndroid.check(permission);
  if (hasPermission) {
    return true;
  }

  const status = await PermissionsAndroid.request(permission);
  return status === 'granted';
}

import ImageModifier from 'react-native-image-modifier'


async function getPhotos() {
  if (Platform.OS === "android" && !(await hasAndroidPermission())) {
    return;
  }

  const photos = await CameraRoll.getPhotos({ first: 5 })
  photos.edges.map(e => {
    console.log(e);
  })

  // const response = await fetch(photos.edges[0].uri)
  // const content = await response.arrayBuffer()
  // console.log(content);

  const param = {
    path: photos.edges[0].uri,
    grayscale: false, // or true
    base64: false, // or true
    resizeRatio: 0.8, // 1.0 is origin value
    imageQuality: 0.7, // 1.0 is max quality value
    extractEXIF: true // or true
  }

  const { success, errorMsg, imageURI, base64String, exif } = await ImageModifier.modify(param)

  console.log({ success, errorMsg, imageURI, base64String, exif });

};