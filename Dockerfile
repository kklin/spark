FROM ubuntu
Maintainer Ethan J. Jackson

RUN apt-get update && apt-get install -y \
        default-jre-headless \
	# wget is used to download Spark, and is used once the container starts to
	# get the container's public IP address by reading checkip.amazonaws.com.
	# This can be removed once Kelda has a mechanism to set an environment variable
	# in the container to the container's public IP address.
        wget \
&& wget -qO- http://www-us.apache.org/dist/spark/spark-2.2.0/spark-2.2.0-bin-hadoop2.7.tgz | tar -xzf - \
&& mv /spark* /spark \
&& rm -rf /var/lib/lists/* /tmp/* /var/tmp/*

# Create a directory for the Spark event log, which stores information about
# past jobs that have completed. Spark requires this directory to be created;
# Spark will not create the directory itself. This filepath is the default
# location that Spark uses.  If the user changes the default location by
# configuring spark.eventLog.dir, this path will need to be updated to match.
RUN mkdir -p /tmp/spark-events

ENV PATH /spark/sbin:/spark/bin:$PATH
