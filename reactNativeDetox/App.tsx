import React, { useState } from 'react';
import { Button, SafeAreaView, ScrollView, StatusBar, Text, useColorScheme, View } from 'react-native';
import { Colors, Header } from 'react-native/Libraries/NewAppScreen';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const [screen, setScreen] = useState('first');

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <Header />
        <View style={backgroundStyle}>
          {screen === 'first' && <View>
            <Text testID="screen-title">Screen 1</Text>
            <Button testID="screen-button" title="click me 1" onPress={() => setScreen('second')} />
          </View>}
          {screen === 'second' && <View>
            <Text testID="screen-title">Screen 2</Text>
            <Button testID="screen-button" title="click me 2" onPress={() => setScreen('first')} />
          </View>}
          <Text style={{ height: 800, borderColor: 'pink', borderStyle: 'solid', borderWidth: 4 }}>Placeholder</Text>
          <Text testID="bottom-text">bottom text</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
