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

This will use the blueprint `sparkRun.js` to launch a cluster of Spark workers
and a Spark master. It will take a bit for the VMs to boot up, for Kelda to
configure the network, and for Docker containers to be initialized. The command
`kelda show` provides useful information about the VMs and containers in the
deployment. The following output reports that the Master VM's public IP is
`54.193.66.67`:

```
$ kelda show
MACHINE         ROLE      PROVIDER    REGION       SIZE        PUBLIC IP         CONNECTED
12c000f87ccf    Master    Amazon      us-west-1    m4.large    54.193.66.67      true
4316db8165d3    Worker    Amazon      us-west-1    m4.large    54.183.187.137    true
...
```

When `CONNECTED` is `true`, the corresponding VM is fully booted and has begun
communicating with Kelda:

Once a machine is `CONNECTED`, you can ssh into to the VM with the command
`kelda ssh <MACHINE_ID>`, (for the machines above, `kelda ssh 12c`) or manually
with `ssh kelda@<PUBLIC_IP>`.

To list all active containers in the cluster, execute `kelda show` again, and
look for `CONTAINER` at the end of the output.  For example:

```
$ kelda show
...
CONTAINER       MACHINE         COMMAND                   LABELS      STATUS     CREATED           PUBLIC IP
13d6b800086a    4316db8165d3    keldaio/spark run master  spark-ms    running    34 seconds ago    54.183.187.137:8080

063f91f017b2    a7749c79b8fe    keldaio/spark run worker  spark-wk    running    34 seconds ago    54.241.148.64:8081
...
```

## Run an example job that computes Pi

To compute Pi, you can use the `run-example` command on the Spark master.
First, determine the ID of the Spark master container (the master has the
container label `spark-ms`).  In the example above, the container running
the Spark master has ID 13d6b.  Next, use that ID to launch the SparkPi
job:

```console
$ kelda ssh 13d6b run-example SparkPi
```

This command will launch a Spark job, and the jobs will be printed to
the command line.  When the job completes, it will output a line that
looks like:

```console
Pi is roughly 3.13959569797849
```

### More information
See [Kelda](http://kelda.io) for more information about Kelda.js.
