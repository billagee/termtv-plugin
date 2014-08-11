#!/bin/bash

# Use JDK 1.7 install; maven tests fail when 1.8 is used.
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk1.7.0_67.jdk/Contents/Home

cd termtv
mvn clean
mvn package

