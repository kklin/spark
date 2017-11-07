# Spark for Kelda.js
This document describes how to run Apache Spark on [Kelda](http://docs.kelda.io)
and launch a job.

## Download the blueprint in this repository

Start by cloning this repository and installing the necessary dependencies:

```console
$ git clone https://github.com/kelda/spark.git
$ cd spark
$ npm install .
```

## Launch an Apache Spark cluster

To launch a Spark cluster, first start a Kelda daemon, if you don't already have
one running:

```console
$ kelda daemon
```

The daemon is a long-running process, so you'll need to run future commands in
a new window (to learn more about the daemon, refer to
the [Kelda documentation](http://docs.kelda.io)).

The Spark blueprint in `sparkRun.js` will start Spark using your default base
infrastructure.  If you haven't done so already, create a default base
infrastructure:

```console
$ kelda init
```

For more about creating a Kelda base infrastructure, refer to the
[Kelda docs](http://docs.kelda.io).

Next, run the Spark blueprint:

```console
$ kelda run ./sparkRun.js
```

This will use the blueprint `sparkRun.js` to launch a Spark cluster. It will take a
bit for the VMs to boot up, for Kelda to
configure the network, and for Docker containers to be initialized. The command
`kelda show` provides useful information about the VMs and containers in the
deployment. The following output reports that the Master VM's public IP is
`54.219.158.97`:

```
$ kelda show
MACHINE         ROLE      PROVIDER    REGION       SIZE         PUBLIC IP        STATUS
i-06a6afa426    Master    Amazon      us-west-1    m3.xlarge    54.219.158.97    connected
i-0f3add6b27    Worker    Amazon      us-west-1    m3.xlarge    54.67.108.98     connected
i-08f8c31070    Worker    Amazon      us-west-1    m3.xlarge    52.53.157.29     connected
i-027e5d72ed    Worker    Amazon      us-west-1    m3.xlarge    54.183.210.94    connected
```

When `STATUS` is `connected`, the corresponding VM is fully booted and has begun
communicating with Kelda:

Once a machine is `connected`, you can ssh into to the VM with the command
`kelda ssh <MACHINE_ID>`, (for the machines above, `kelda ssh i-06a` to ssh into
the master).

To list all active containers in the cluster, execute `kelda show` again, and
look for the `CONTAINER` section at the end of the output.  For example:

```
$ kelda show
...
CONTAINER       MACHINE         COMMAND HOSTNAME        STATUS     CREATED              PUBLIC IP
0b8eb391d8ce    i-027e5d72ed    ...     spark-master    running    About an hour ago    54.183.210.94:8080
62567da92a76    i-08f8c31070    ...     spark-worker    running    About an hour ago    52.53.157.29:8081
9f7eee19a330    i-0f3add6b27    ...     spark-driver    running    About an hour ago    54.67.108.98:[4040,18080]
b8010a0970b3    i-0f3add6b27    ...     spark-worker2   running    About an hour ago    54.67.108.98:8081
...
```

The blueprint launches a few containers.  The container that users will interact with
is the container with hostname `spark-driver`, which is intended to be used to launch
Spark jobs (the following section describes how to launch a job in more detail). The
blueprint also creates a container with hostname `spark-master` that runs the Spark
Standalone Scheduler Master (which handles scheduling Spark applications), and many
Spark worker containers, which run tasks for Spark jobs.

## Running Jobs

Users can run Spark jobs using the `spark-driver` container.  This container is configured
to automatically submit jobs to the standalone master to be scheduled, and the network
for this container is configured to allow public access to the Spark UI.  To login to the
Spark driver, find the container ID corresponding to the container with hostname
`spark-driver`, and use the `kelda ssh` command.  For example, for the `kelda show` output
above:

```console
$ kelda ssh 9f7ee
```

All of the Spark commands are included in the container path.  To launch the Spark shell,
once SSH'ed into the container, run `spark-shell`:

```console
$ spark-shell
Spark context Web UI available at http://54.67.108.98:4040
Spark context available as 'sc' (master = spark://spark-master.q:7077, app id = app-20171107203134-0001).
Spark session available as 'spark'.
Welcome to
      ____              __
     / __/__  ___ _____/ /__
    _\ \/ _ \/ _ `/ __/  '_/
   /___/ .__/\_,_/_/ /_/\_\   version 2.2.0
      /_/

Using Scala version 2.11.8 (OpenJDK 64-Bit Server VM, Java 1.8.0_131)
Type in expressions to have them evaluated.
Type :help for more information.

scala>
```

### Run an example job that computes Pi

To compute Pi, you can use the `run-example` command on the Spark driver.
You can `ssh` into the container, as above, or you can run the job by passing a
command into `kelda ssh`:

```console
$ kelda ssh 9f7ee run-example SparkPi
```

This command will launch a Spark job, and the jobs will be printed to
the command line.  When the job completes, it will output a line that
looks like:

```console
Pi is roughly 3.13959569797849
```

### More information
See [Kelda](http://kelda.io) for more information about Kelda.js.
