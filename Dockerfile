FROM ubuntu
Maintainer Ethan J. Jackson

RUN apt-get update && apt-get install -y \
        default-jre-headless \
        python-minimal \
	# wget is used to download Spark, and is used once the container starts to
	# get the container's public IP address by reading checkip.amazonaws.com.
	# This can be removed once Kelda has a mechanism to set an environment variable
	# in the container to the container's public IP address.
        wget \
&& wget -qO- http://www-us.apache.org/dist/spark/spark-2.2.0/spark-2.2.0-bin-hadoop2.7.tgz | tar -xzf - \
&& mv /spark* /spark \
&& rm -rf /var/lib/lists/* /tmp/* /var/tmp/*

ENV PATH /spark/sbin:/spark/bin:$PATH

COPY run /bin/
COPY log4j.properties /spark/conf
