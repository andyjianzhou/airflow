/*!
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Text,
  Box,
  Flex,
  Button,
  Checkbox,
  Icon,
  Spinner,
  ButtonGroup,
} from "@chakra-ui/react";
import { MdWarning } from "react-icons/md";

import { getMetaValue } from "src/utils";
import useTaskLog from "src/api/useTaskLog";
import LinkButton from "src/components/LinkButton";
import { useTimezone } from "src/context/timezone";
import type { Dag, DagRun, TaskInstance } from "src/types";
import MultiSelect from "src/components/MultiSelect";
import URLSearchParamsWrapper from "src/utils/URLSearchParamWrapper";
import { useTaskInstance } from "src/api";

import LogLink from "./LogLink";
import { LogLevel, logLevelColorMapping, parseLogs } from "./utils";
import LogBlock from "./LogBlock";
import TrySelector from "../TrySelector";

interface LogLevelOption {
  label: LogLevel;
  value: LogLevel;
  color: string;
}

interface FileSourceOption {
  label: string;
  value: string;
}

const showExternalLogRedirect =
  getMetaValue("show_external_log_redirect") === "True";
const externalLogName = getMetaValue("external_log_name");
const logUrl = getMetaValue("log_url");

const logLevelOptions: Array<LogLevelOption> = Object.values(LogLevel).map(
  (value): LogLevelOption => ({
    label: value,
    value,
    color: logLevelColorMapping[value],
  })
);

interface Props {
  dagId: Dag["id"];
  dagRunId: DagRun["runId"];
  taskId: TaskInstance["taskId"];
  mapIndex?: TaskInstance["mapIndex"];
  executionDate: DagRun["executionDate"];
  tryNumber: TaskInstance["tryNumber"];
  state?: TaskInstance["state"];
}

const Logs = ({
  dagId,
  dagRunId,
  taskId,
  mapIndex,
  executionDate,
  tryNumber: finalTryNumber,
  state,
}: Props) => {
  const [selectedTryNumber, setSelectedTryNumber] = useState(
    finalTryNumber || 1
  );
  const [wrap, setWrap] = useState(getMetaValue("default_wrap") === "True");
  const [logLevelFilters, setLogLevelFilters] = useState<Array<LogLevelOption>>(
    []
  );
  const [fileSourceFilters, setFileSourceFilters] = useState<
    Array<FileSourceOption>
  >([]);
  const [unfoldedLogGroups, setUnfoldedLogGroup] = useState<Array<string>>([]);
  const { timezone } = useTimezone();

  const { data: taskInstance } = useTaskInstance({
    dagId,
    dagRunId,
    taskId: taskId || "",
    mapIndex,
  });

  const { data, isLoading } = useTaskLog({
    dagId,
    dagRunId,
    taskId,
    mapIndex,
    taskTryNumber: selectedTryNumber,
    state,
  });

  const params = new URLSearchParamsWrapper({
    task_id: taskId,
    execution_date: executionDate,
  });

  if (mapIndex !== undefined) {
    params.append("map_index", mapIndex.toString());
  }

  const {
    parsedLogs,
    fileSources = [],
    warning,
  } = useMemo(
    () =>
      parseLogs(
        data,
        timezone,
        logLevelFilters.map((option) => option.value),
        fileSourceFilters.map((option) => option.value),
        unfoldedLogGroups
      ),
    [data, fileSourceFilters, logLevelFilters, timezone, unfoldedLogGroups]
  );

  useEffect(() => {
    // Reset fileSourceFilters and selected attempt when changing to
    // a task that do not have those filters anymore.
    if (selectedTryNumber > (finalTryNumber || 1)) {
      setSelectedTryNumber(finalTryNumber || 1);
    }

    if (
      data &&
      fileSourceFilters.length > 0 &&
      fileSourceFilters.reduce(
        (isSourceMissing, option) =>
          isSourceMissing || !fileSources.includes(option.value),
        false
      )
    ) {
      setFileSourceFilters([]);
    }
  }, [data, fileSourceFilters, fileSources, selectedTryNumber, finalTryNumber]);

  return (
    <>
      {showExternalLogRedirect && externalLogName && (
        <Box my={1}>
          <Text>View Logs in {externalLogName} Task Instance Try Number:</Text>
          <Flex flexWrap="wrap">
            {Array.from({ length: finalTryNumber || 1 }, (_, i) => i + 1).map(
              (tryNumber) => (
                <LogLink
                  key={tryNumber}
                  dagId={dagId}
                  taskId={taskId}
                  executionDate={executionDate}
                  tryNumber={tryNumber}
                />
              )
            )}
          </Flex>
        </Box>
      )}
      <Box>
        {!!taskInstance && (
          <TrySelector
            taskInstance={taskInstance}
            selectedTryNumber={selectedTryNumber}
            onSelectTryNumber={setSelectedTryNumber}
          />
        )}
        <Flex my={1} justifyContent="space-between" flexWrap="wrap">
          <Flex alignItems="center" flexGrow={1} mr={10}>
            <Box width="100%" mr={2}>
              <MultiSelect
                size="sm"
                isMulti
                options={logLevelOptions}
                placeholder="All Levels"
                value={logLevelFilters}
                onChange={(options) => setLogLevelFilters([...options])}
                chakraStyles={{
                  multiValue: (provided, ...rest) => ({
                    ...provided,
                    backgroundColor: rest[0].data.color,
                  }),
                  option: (provided, ...rest) => ({
                    ...provided,
                    borderLeft: "solid 4px black",
                    borderColor: rest[0].data.color,
                    mt: 2,
                  }),
                }}
              />
            </Box>
            <Box width="100%">
              <MultiSelect
                size="sm"
                isMulti
                options={fileSources.map((fileSource) => ({
                  label: fileSource,
                  value: fileSource,
                }))}
                placeholder="All File Sources"
                value={fileSourceFilters}
                onChange={(options) => setFileSourceFilters([...options])}
              />
            </Box>
          </Flex>
          <Flex alignItems="center" flexWrap="wrap">
            <Checkbox
              isChecked={wrap}
              onChange={() => setWrap((previousState) => !previousState)}
              px={4}
              data-testid="wrap-checkbox"
            >
              <Text as="strong">Wrap</Text>
            </Checkbox>
            <LogLink
              dagId={dagId}
              taskId={taskId}
              executionDate={executionDate}
              isInternal
              tryNumber={selectedTryNumber}
              mapIndex={mapIndex}
            />
            <LinkButton href={`${logUrl}&${params.toString()}`}>
              See More
            </LinkButton>
          </Flex>
        </Flex>
      </Box>
      {!!warning && (
        <Flex
          bg="yellow.200"
          borderRadius={2}
          borderColor="gray.400"
          alignItems="center"
          p={2}
        >
          <Icon as={MdWarning} color="yellow.500" mr={2} />
          <Text fontSize="sm">{warning}</Text>
        </Flex>
      )}
      {isLoading ? (
        <Spinner />
      ) : (
        !!parsedLogs && (
          <Box flex="1" overflow="auto" maxHeight="60vh">
            <LogBlock
              parsedLogs={parsedLogs}
              wrap={wrap}
              tryNumber={selectedTryNumber}
              unfoldedGroups={unfoldedLogGroups}
              setUnfoldedLogGroup={setUnfoldedLogGroup}
            />
            <Box my={3}>
              {/* Temporary fix adding overflow (for long logs). Componentizing logs will fix it. Will do later */}
              <Text as="span">Log Page Number</Text>
              <Flex flexWrap="wrap" my={2}>
                {/* TODO: Replace [1,2] with API call to get the log size -> # required pages */}
                {[1, 2].map((index) => (
                  <ButtonGroup size="sm">
                    <Button
                      variant={selectedTryNumber === index ? "solid" : "ghost"}
                      colorScheme="blue"
                      onClick={() => setSelectedTryNumber(index)}
                      data-testid={`log-attempt-select-button-${index}`}
                    >
                      {index}
                    </Button>
                  </ButtonGroup>
                ))}
              </Flex>
            </Box>
          </Box>
        )
      )}
    </>
  );
};

export default Logs;
