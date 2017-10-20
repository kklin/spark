FROM ubuntu
Maintainer Ethan J. Jackson

RUN apt-get update && apt-get install -y \
        default-jre-headless \
        python-minimal \
        wget \
&& wget -qO- http://www-us.apache.org/dist/spark/spark-1.6.3/spark-1.6.3-bin-hadoop2.6.tgz | tar -xzf - \
&& mv /spark* /spark \
&& apt-get remove --purge -y wget \
&& apt-get autoremove --purge -y \
&& rm -rf /var/lib/lists/* /tmp/* /var/tmp/*

ENV PATH /spark/sbin:/spark/bin:$PATH

COPY run /bin/
COPY log4j.properties /spark/conf
