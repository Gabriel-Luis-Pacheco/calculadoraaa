FROM maven:3.9.11-eclipse-temurin-21 AS build
ARG ENGINE
WORKDIR /source
COPY motores/$ENGINE/ ./
RUN mvn -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
ARG ARTIFACT
RUN mkdir -p /app/calculadora/db && chown -R 10001:0 /app
COPY --from=build /source/target/$ARTIFACT.jar /app/app.jar
USER 10001
ENV SPRING_PROFILES_ACTIVE=offline
EXPOSE 8080 8082
ENTRYPOINT ["java","-XX:MaxRAMPercentage=70","-jar","/app/app.jar"]
