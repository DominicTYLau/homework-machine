#include <Arduino.h>
#include <Adafruit_PWMServoDriver.h>
#include <Adafruit_SPIDevice.h>

Adafruit_PWMServoDriver srituhobby = Adafruit_PWMServoDriver();

#define servoMIN 92
#define servoMAX 644

void setup() {
  Serial.begin(9600);
  srituhobby.begin();
  srituhobby.setPWMFreq(60);
}

void loop() {
    srituhobby.setPWM(1, 0, servoMIN);
    delay(2000);
    srituhobby.setPWM(1, 0, servoMAX);
    delay(2000);
}