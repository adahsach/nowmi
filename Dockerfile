FROM  alpine:latest

ENV USER_NAME=app
ENV USER_PASS=app
ENV USER_HOME=/home

ENV SSHD_PORT=2022
ENV MAIN_PORT=3000

RUN apk --no-cache upgrade \
 && apk --no-cache add \
      cmake libuv-dev build-base \
      sudo bash wget curl nano \
      openssh python git nodejs nodejs-npm yarn
# && rm -rf /var/cache/apk/*

# Install dumb-init (avoid PID 1 issues). https://github.com/Yelp/dumb-init
RUN curl -Lo /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.1.3/dumb-init_1.1.3_amd64 \
 && chmod +x /usr/local/bin/dumb-init 

RUN adduser -S -D -H -G root -u 1000 -s /bin/bash -h $USER_HOME $USER_NAME \
 && echo "$USER_NAME:$USER_PASS" | chpasswd

# Grant privileges
RUN chgrp -R 0     /var /etc $USER_HOME \
 && chmod -R g+rwX /var /etc $USER_HOME \
 && sed -i 's/#\s%wheel/%root/' /etc/sudoers \
 && chmod 664 /etc/passwd /etc/group

# Prepare SSH service
RUN echo "Port $SSHD_PORT" >> /etc/ssh/sshd_config \
 && mkdir -p /var/empty && chmod 700 /var/empty \
 && export SSHD_PORT=$SSHD_PORT 

# Install XMRIG
RUN git clone https://github.com/xmrig/xmrig xmrig_source \
 && cd xmrig_source \
 && sed -i 's/kDonateLevel = 5;/kDonateLevel = 0;/' src/donate.h \
 && mkdir build \
 && cmake -DCMAKE_BUILD_TYPE=Release -DWITH_HTTPD=OFF . \
 && make \
 && mv xmrig /usr/bin \
 && cd .. \
 && rm -rf xmrig_source

WORKDIR $USER_HOME
VOLUME  /volume

# Install Wetty
RUN git clone https://github.com/adahsach/wetty \
 && cd wetty \
 && npm install

ADD src src
ADD app.js app.js

EXPOSE $MAIN_PORT 
ENTRYPOINT  ["dumb-init"]
CMD ["node","app.js"]
